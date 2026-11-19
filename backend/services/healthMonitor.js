/**
 * healthMonitor.js
 * Automated Career Portal Health Monitoring Service for Ascend
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { validateSafeUrl } = require("../utils/ssrfValidator");

const DATA_DIR = path.join(__dirname, "../data");
const DEFAULT_COMPANIES_FILE = path.join(DATA_DIR, "companies.json");
const DEFAULT_RESULTS_FILE = path.join(DATA_DIR, "monitoringResults.json");

const TIMEOUT_MS = 15000; // 15-second timeout
const MAX_CONCURRENCY = 5; // Concurrency limit to prevent overwhelming networks
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (Ascend HealthCheck/1.0)";

class HealthMonitor {
  constructor(options = {}) {
    this.companiesFile = options.companiesFile || DEFAULT_COMPANIES_FILE;
    this.resultsFile = options.resultsFile || DEFAULT_RESULTS_FILE;
    this.results = new Map();
    this.isChecking = false;
    this.lastRunAt = null;
    this.cronTask = null;

    this.initStorage();
  }

  /**
   * Initialize data directory and load existing persisted results
   */
  initStorage() {
    const dir = path.dirname(this.resultsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.resultsFile)) {
      try {
        const raw = fs.readFileSync(this.resultsFile, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.results)) {
          parsed.results.forEach((item) => {
            // Only store valid company IDs from the registered dataset (ignoring legacy mock IDs)
            if (item && typeof item.companyId === "number" && item.companyId < 9000) {
              this.results.set(item.companyId, item);
            }
          });
        }
        this.lastRunAt = parsed.summary ? parsed.summary.lastRunAt : null;
      } catch (err) {
        console.warn("[HealthMonitor] Failed to load existing results from disk:", err.message);
      }
    }
  }

  /**
   * Persist current results to disk safely using atomic rename
   */
  saveResults() {
    try {
      const summary = this.getSummary();
      const payload = {
        summary,
        results: Array.from(this.results.values())
      };
      const tmpFile = `${this.resultsFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), "utf8");
      fs.renameSync(tmpFile, this.resultsFile);
    } catch (err) {
      console.error("[HealthMonitor] Error persisting monitoring results:", err.message);
    }
  }

  /**
   * Load enabled companies list from the registered dataset
   */
  getEnabledCompanies() {
    if (!fs.existsSync(this.companiesFile)) {
      console.error("[HealthMonitor] companies.json not found in", this.companiesFile);
      return [];
    }
    const raw = fs.readFileSync(this.companiesFile, "utf8");
    const list = JSON.parse(raw);
    return list.filter((c) => c.enabled !== false && c.careersUrl);
  }

  /**
   * Classify HTTP status code or error into UP, DOWN, or UNKNOWN
   */
  classifyStatus(statusCode, errorCode = null) {
    if (statusCode) {
      if (statusCode >= 200 && statusCode < 400) {
        return "UP";
      }
      if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
        // Restricted / Bot Protection / Rate Limited - portal exists but restricts automated crawlers
        return "UNKNOWN";
      }
      if (statusCode >= 500 || statusCode === 404 || statusCode === 410) {
        return "DOWN";
      }
      return "UNKNOWN";
    }

    if (errorCode) {
      if (
        errorCode === "ENOTFOUND" ||
        errorCode === "EAI_AGAIN" ||
        errorCode === "ECONNREFUSED"
      ) {
        return "DOWN";
      }
      if (errorCode === "ECONNABORTED" || errorCode === "ETIMEDOUT") {
        return "DOWN";
      }
    }

    return "UNKNOWN";
  }

  /**
   * Performs a single HTTP check against a company's careers URL with SSRF protection
   */
  async checkPortalUrl(url) {
    // 1. SSRF Protection validation
    const ssrfCheck = validateSafeUrl(url);
    if (!ssrfCheck.safe) {
      return {
        status: "DOWN",
        httpStatusCode: null,
        responseTimeMs: 0,
        errorMessage: `SSRF Block: ${ssrfCheck.error}`
      };
    }

    const startTime = Date.now();
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        timeout: TIMEOUT_MS,
        maxRedirects: 5,
        validateStatus: () => true // Allow handling all status codes manually
      });

      const responseTimeMs = Date.now() - startTime;
      const statusCode = response.status;
      const status = this.classifyStatus(statusCode);

      return {
        status,
        httpStatusCode: statusCode,
        responseTimeMs,
        errorMessage: status === "UNKNOWN" && (statusCode === 403 || statusCode === 429)
          ? `HTTP ${statusCode} (Protected / Inconclusive)`
          : null
      };
    } catch (err) {
      const responseTimeMs = Date.now() - startTime;
      const errorCode = err.code || "NETWORK_ERROR";
      const status = this.classifyStatus(null, errorCode);

      return {
        status,
        httpStatusCode: null,
        responseTimeMs,
        errorMessage: err.message || errorCode
      };
    }
  }

  /**
   * Check a single company with 1 retry on failure
   */
  async checkCompany(company) {
    const previous = this.results.get(company.id);
    let checkResult = await this.checkPortalUrl(company.careersUrl);

    // If initial check resulted in DOWN, retry once after a short delay before declaring down
    if (checkResult.status === "DOWN" && !checkResult.errorMessage?.startsWith("SSRF Block")) {
      await new Promise((res) => setTimeout(res, 1000));
      const retryResult = await this.checkPortalUrl(company.careersUrl);
      if (retryResult.status === "UP") {
        checkResult = retryResult;
      } else {
        checkResult.errorMessage = `Failed after retry: ${checkResult.errorMessage || "Outage"}`;
      }
    }

    // Status persistence logic:
    // If check was inconclusive (e.g. 403/429 Cloudflare bot challenge), preserve previous known UP status if present
    let finalStatus = checkResult.status;
    let consecutiveFailures = previous ? previous.consecutiveFailures || 0 : 0;

    if (finalStatus === "DOWN") {
      consecutiveFailures += 1;
    } else if (finalStatus === "UP") {
      consecutiveFailures = 0;
    } else if (finalStatus === "UNKNOWN" && previous && previous.status === "UP") {
      // Preserve known UP status while noting inconclusive response
      finalStatus = "UP";
    }

    const record = {
      companyId: company.id,
      companyName: company.name,
      careersUrl: company.careersUrl,
      status: finalStatus,
      httpStatusCode: checkResult.httpStatusCode,
      responseTimeMs: checkResult.responseTimeMs,
      lastCheckedAt: new Date().toISOString(),
      errorMessage: checkResult.errorMessage,
      consecutiveFailures
    };

    this.results.set(company.id, record);
    return record;
  }

  /**
   * Run health checks on all enabled companies with controlled concurrency
   */
  async runAllChecks() {
    if (this.isChecking) {
      console.log("[HealthMonitor] A health check run is already in progress. Skipping.");
      return;
    }

    this.isChecking = true;
    console.log("[HealthMonitor] Starting health checks for all enabled companies...");

    try {
      const companies = this.getEnabledCompanies();
      let index = 0;

      const worker = async () => {
        while (index < companies.length) {
          const company = companies[index++];
          try {
            await this.checkCompany(company);
          } catch (err) {
            console.error(`[HealthMonitor] Error checking company ${company.name}:`, err.message);
          }
        }
      };

      const workers = [];
      for (let i = 0; i < Math.min(MAX_CONCURRENCY, companies.length); i++) {
        workers.push(worker());
      }

      await Promise.all(workers);

      this.lastRunAt = new Date().toISOString();
      this.saveResults();

      const summary = this.getSummary();
      console.log(
        `[HealthMonitor] Health check complete. Total: ${summary.totalMonitored}, UP: ${summary.up}, DOWN: ${summary.down}, UNKNOWN: ${summary.unknown}`
      );
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Get monitoring summary stats
   */
  getSummary() {
    const records = Array.from(this.results.values());
    let up = 0;
    let down = 0;
    let unknown = 0;

    records.forEach((r) => {
      if (r.status === "UP") up++;
      else if (r.status === "DOWN") down++;
      else unknown++;
    });

    return {
      totalMonitored: records.length,
      up,
      down,
      unknown,
      lastRunAt: this.lastRunAt,
      isRunning: this.isChecking
    };
  }

  /**
   * Return full monitoring status payload
   */
  getStatus() {
    return {
      summary: this.getSummary(),
      results: Array.from(this.results.values())
    };
  }

  /**
   * Start automated scheduler: runs every 60 minutes
   * Note: Periodic cron jobs require an active process and will not execute
   * when deployed on serverless platforms that sleep or scale to zero.
   */
  startScheduler(runInitial = true) {
    if (this.cronTask) {
      return;
    }

    // Schedule to run every 60 minutes at minute 0
    this.cronTask = cron.schedule("0 * * * *", () => {
      console.log("[HealthMonitor] Executing scheduled 60-minute health check.");
      this.runAllChecks().catch((err) => {
        console.error("[HealthMonitor] Scheduled check failed:", err.message);
      });
    });

    console.log("[HealthMonitor] Scheduled automated monitoring every 60 minutes.");

    if (runInitial) {
      // Run initial check slightly deferred so the server port can open first
      setTimeout(() => {
        this.runAllChecks().catch((err) => {
          console.error("[HealthMonitor] Initial check failed:", err.message);
        });
      }, 2000);
    }
  }

  /**
   * Stop scheduler (useful in tests or shutdown)
   */
  stopScheduler() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }
}

// Export singleton instance as well as the class for testing isolation
const healthMonitor = new HealthMonitor();
healthMonitor.HealthMonitor = HealthMonitor;

module.exports = healthMonitor;
