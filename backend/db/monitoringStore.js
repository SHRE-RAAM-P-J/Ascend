/**
 * db/monitoringStore.js
 * Database persistence layer for Ascend health monitoring.
 *
 * Interacts with PostgreSQL (Supabase) via client pool.
 * Falls back safely to JSON file operations when DATABASE_URL is not configured.
 */

"use strict";

const crypto = require("crypto");
const pool = require("./client");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const JSON_RESULTS_FILE = path.join(DATA_DIR, "monitoringResults.json");

function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Helper to execute a query using the pool
 */
async function query(text, params = []) {
  if (!isDbConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }
  return pool.query(text, params);
}

/**
 * Retrieve monitoring status and summary.
 * Reads from PostgreSQL when available, falls back to JSON file.
 */
async function getStatus() {
  if (isDbConfigured()) {
    try {
      const res = await query(
        `SELECT
          company_id AS "companyId",
          company_name AS "companyName",
          careers_url AS "careersUrl",
          status,
          http_status_code AS "httpStatusCode",
          response_time_ms AS "responseTimeMs",
          last_checked_at AS "lastCheckedAt",
          error_message AS "errorMessage",
          consecutive_failures AS "consecutiveFailures"
        FROM monitoring_results
        ORDER BY company_id ASC`
      );

      const results = res.rows.map((row) => ({
        ...row,
        lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt).toISOString() : null
      }));

      let up = 0;
      let down = 0;
      let unknown = 0;
      let latestCheckedAt = null;

      results.forEach((r) => {
        if (r.status === "UP") up++;
        else if (r.status === "DOWN") down++;
        else unknown++;

        if (r.lastCheckedAt) {
          const t = new Date(r.lastCheckedAt).getTime();
          if (!latestCheckedAt || t > new Date(latestCheckedAt).getTime()) {
            latestCheckedAt = r.lastCheckedAt;
          }
        }
      });

      // Check if an active monitoring job is currently running
      const activeJob = await getActiveJob().catch(() => null);

      return {
        summary: {
          totalMonitored: results.length,
          up,
          down,
          unknown,
          lastRunAt: latestCheckedAt,
          isRunning: Boolean(activeJob && (activeJob.status === "running" || activeJob.status === "pending"))
        },
        results
      };
    } catch (err) {
      console.warn("[MonitoringStore] DB getStatus query failed, attempting JSON fallback:", err.message);
    }
  }

  // Local JSON fallback
  if (fs.existsSync(JSON_RESULTS_FILE)) {
    try {
      const raw = fs.readFileSync(JSON_RESULTS_FILE, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      console.error("[MonitoringStore] Failed reading JSON fallback:", e.message);
    }
  }

  return {
    summary: { totalMonitored: 0, up: 0, down: 0, unknown: 0, lastRunAt: null, isRunning: false },
    results: []
  };
}

// In-memory fallback for local dev / tests when PostgreSQL is not connected
const memoryJobs = new Map();

/**
 * Upsert a batch of monitoring results to PostgreSQL (or local JSON fallback)
 */
async function upsertResultsBatch(records) {
  if (!records || records.length === 0) return;

  if (isDbConfigured()) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of records) {
        await client.query(
          `INSERT INTO monitoring_results (
            company_id, company_name, careers_url, status,
            http_status_code, response_time_ms, last_checked_at,
            error_message, consecutive_failures, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (company_id) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            careers_url = EXCLUDED.careers_url,
            status = EXCLUDED.status,
            http_status_code = EXCLUDED.http_status_code,
            response_time_ms = EXCLUDED.response_time_ms,
            last_checked_at = EXCLUDED.last_checked_at,
            error_message = EXCLUDED.error_message,
            consecutive_failures = EXCLUDED.consecutive_failures,
            updated_at = NOW()`,
          [
            r.companyId,
            r.companyName,
            r.careersUrl,
            r.status,
            r.httpStatusCode || null,
            r.responseTimeMs || 0,
            r.lastCheckedAt || new Date().toISOString(),
            r.errorMessage || null,
            r.consecutiveFailures || 0
          ]
        );
      }
      await client.query("COMMIT");
      return;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Fallback to local JSON file update
  if (fs.existsSync(JSON_RESULTS_FILE)) {
    try {
      const raw = fs.readFileSync(JSON_RESULTS_FILE, "utf8");
      const data = JSON.parse(raw);
      const resultMap = new Map((data.results || []).map((i) => [i.companyId, i]));
      records.forEach((r) => resultMap.set(r.companyId, r));
      const updatedResults = Array.from(resultMap.values());
      let up = 0, down = 0, unknown = 0;
      updatedResults.forEach((i) => {
        if (i.status === "UP") up++;
        else if (i.status === "DOWN") down++;
        else unknown++;
      });
      data.summary = {
        totalMonitored: updatedResults.length,
        up,
        down,
        unknown,
        lastRunAt: new Date().toISOString(),
        isRunning: false
      };
      data.results = updatedResults;
      fs.writeFileSync(JSON_RESULTS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.warn("[MonitoringStore] JSON fallback write failed:", e.message);
    }
  }
}

/**
 * Retrieve existing results as a Map<companyId, { status, consecutiveFailures }>
 * for maintaining continuity during batch checks
 */
async function getExistingResultMap() {
  const map = new Map();
  if (isDbConfigured()) {
    try {
      const res = await query(
        `SELECT company_id, status, consecutive_failures FROM monitoring_results`
      );
      res.rows.forEach((row) => {
        map.set(row.company_id, {
          status: row.status,
          consecutiveFailures: row.consecutive_failures || 0
        });
      });
      return map;
    } catch (err) {
      console.warn("[MonitoringStore] getExistingResultMap DB error:", err.message);
    }
  }

  // Fallback to local JSON
  if (fs.existsSync(JSON_RESULTS_FILE)) {
    try {
      const raw = fs.readFileSync(JSON_RESULTS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.results)) {
        parsed.results.forEach((r) => {
          map.set(r.companyId, {
            status: r.status,
            consecutiveFailures: r.consecutiveFailures || 0
          });
        });
      }
    } catch {
      // ignore
    }
  }
  return map;
}

/**
 * Find active pending or running job
 */
async function getActiveJob() {
  if (isDbConfigured()) {
    try {
      const res = await query(
        `SELECT
          id, status, total_companies AS "totalCompanies",
          processed_companies AS "processedCompanies",
          next_offset AS "nextOffset",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          last_error AS "lastError",
          lease_until AS "leaseUntil",
          created_at AS "createdAt"
        FROM monitoring_jobs
        WHERE status IN ('pending', 'running')
          AND (lease_until IS NULL OR lease_until > NOW() - INTERVAL '3 minutes')
        ORDER BY created_at DESC
        LIMIT 1`
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn("[MonitoringStore] getActiveJob DB error:", err.message);
    }
  }

  // Memory fallback
  const now = Date.now();
  for (const job of memoryJobs.values()) {
    if (
      (job.status === "pending" || job.status === "running") &&
      (!job.leaseUntil || new Date(job.leaseUntil).getTime() > now - 180000)
    ) {
      return job;
    }
  }
  return null;
}

/**
 * Fetch a job by ID
 */
async function getJob(jobId) {
  if (isDbConfigured()) {
    try {
      const res = await query(
        `SELECT
          id, status, total_companies AS "totalCompanies",
          processed_companies AS "processedCompanies",
          next_offset AS "nextOffset",
          company_snapshot AS "companySnapshot",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          last_error AS "lastError",
          lease_until AS "leaseUntil",
          created_at AS "createdAt"
        FROM monitoring_jobs
        WHERE id = $1`,
        [jobId]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn("[MonitoringStore] getJob DB error:", err.message);
    }
  }

  return memoryJobs.get(jobId) || null;
}

/**
 * Create a new monitoring job with a snapshot of companies to process
 */
async function createJob(companiesList) {
  const jobId = crypto.randomUUID();

  if (isDbConfigured()) {
    try {
      const snapshotJson = JSON.stringify(companiesList);
      const res = await query(
        `INSERT INTO monitoring_jobs (
          id, status, total_companies, processed_companies, next_offset, company_snapshot, started_at
        ) VALUES ($1, 'pending', $2, 0, 0, $3, NOW())
        RETURNING
          id, status, total_companies AS "totalCompanies",
          processed_companies AS "processedCompanies",
          next_offset AS "nextOffset",
          started_at AS "startedAt",
          created_at AS "createdAt"`,
        [jobId, companiesList.length, snapshotJson]
      );
      return res.rows[0];
    } catch (err) {
      console.warn("[MonitoringStore] createJob DB error, falling back to memory:", err.message);
    }
  }

  const job = {
    id: jobId,
    status: "pending",
    totalCompanies: companiesList.length,
    processedCompanies: 0,
    nextOffset: 0,
    companySnapshot: companiesList,
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastError: null,
    leaseUntil: null,
    createdAt: new Date().toISOString()
  };
  memoryJobs.set(jobId, job);
  return job;
}

/**
 * Acquire batch processing lease on a job for serverless execution
 */
async function acquireBatchLease(jobId, leaseMs = 25000) {
  if (isDbConfigured()) {
    try {
      const res = await query(
        `UPDATE monitoring_jobs
        SET
          status = 'running',
          lease_until = NOW() + ($2 * INTERVAL '1 millisecond')
        WHERE id = $1
          AND status IN ('pending', 'running')
          AND (lease_until IS NULL OR lease_until < NOW())
        RETURNING
          id, status, total_companies AS "totalCompanies",
          processed_companies AS "processedCompanies",
          next_offset AS "nextOffset",
          company_snapshot AS "companySnapshot"`,
        [jobId, leaseMs]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn("[MonitoringStore] acquireBatchLease DB error:", err.message);
    }
  }

  const job = memoryJobs.get(jobId);
  if (!job) return null;
  const now = Date.now();
  if (
    (job.status === "pending" || job.status === "running") &&
    (!job.leaseUntil || new Date(job.leaseUntil).getTime() < now)
  ) {
    job.status = "running";
    job.leaseUntil = new Date(now + leaseMs).toISOString();
    return job;
  }
  return null;
}

/**
 * Update job progress after a batch finishes
 */
async function updateJobProgress(jobId, { processedCompanies, nextOffset, status, completedAt, lastError }) {
  if (isDbConfigured()) {
    try {
      await query(
        `UPDATE monitoring_jobs
        SET
          processed_companies = $2,
          next_offset = $3,
          status = $4,
          completed_at = $5,
          last_error = $6,
          lease_until = NULL
        WHERE id = $1`,
        [jobId, processedCompanies, nextOffset, status, completedAt || null, lastError || null]
      );
      return;
    } catch (err) {
      console.warn("[MonitoringStore] updateJobProgress DB error:", err.message);
    }
  }

  const job = memoryJobs.get(jobId);
  if (job) {
    job.processedCompanies = processedCompanies;
    job.nextOffset = nextOffset;
    job.status = status;
    job.completedAt = completedAt || null;
    job.lastError = lastError || null;
    job.leaseUntil = null;
  }
}

/**
 * Cancel an unfinished job
 */
async function cancelJob(jobId) {
  if (isDbConfigured()) {
    try {
      const res = await query(
        `UPDATE monitoring_jobs
        SET
          status = 'cancelled',
          completed_at = NOW(),
          lease_until = NULL
        WHERE id = $1 AND status IN ('pending', 'running')
        RETURNING id`,
        [jobId]
      );
      return res.rowCount > 0;
    } catch (err) {
      console.warn("[MonitoringStore] cancelJob DB error:", err.message);
    }
  }

  const job = memoryJobs.get(jobId);
  if (job && (job.status === "pending" || job.status === "running")) {
    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    job.leaseUntil = null;
    return true;
  }
  return false;
}

module.exports = {
  isDbConfigured,
  query,
  getStatus,
  upsertResultsBatch,
  getExistingResultMap,
  getActiveJob,
  getJob,
  createJob,
  acquireBatchLease,
  updateJobProgress,
  cancelJob
};
