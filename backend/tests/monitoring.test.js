/**
 * monitoring.test.js
 * Test suite for Ascend Health Monitoring Service
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const healthMonitor = require("../services/healthMonitor");

async function runTests() {
  console.log("==========================================");
  console.log("Running Ascend Health Monitor Test Suite");
  console.log("==========================================");

  // 1. Status classification tests
  console.log("\n[Test 1] Status Classification Logic:");
  
  // Working website (200 OK)
  assert.strictEqual(healthMonitor.classifyStatus(200), "UP", "200 should be UP");
  assert.strictEqual(healthMonitor.classifyStatus(204), "UP", "204 should be UP");
  console.log("  ✔ HTTP 2xx classified as UP");

  // Redirect (301, 302, 307, 308)
  assert.strictEqual(healthMonitor.classifyStatus(301), "UP", "301 should be UP");
  assert.strictEqual(healthMonitor.classifyStatus(302), "UP", "302 should be UP");
  console.log("  ✔ HTTP 3xx classified as UP (redirected)");

  // Server error (500, 502, 503)
  assert.strictEqual(healthMonitor.classifyStatus(500), "DOWN", "500 should be DOWN");
  assert.strictEqual(healthMonitor.classifyStatus(503), "DOWN", "503 should be DOWN");
  console.log("  ✔ HTTP 5xx classified as DOWN");

  // Client dead link (404)
  assert.strictEqual(healthMonitor.classifyStatus(404), "DOWN", "404 should be DOWN");
  console.log("  ✔ HTTP 404 classified as DOWN");

  // Bot protection / Rate limit (403, 429) -> UNKNOWN (Never false DOWN)
  assert.strictEqual(healthMonitor.classifyStatus(403), "UNKNOWN", "403 should be UNKNOWN");
  assert.strictEqual(healthMonitor.classifyStatus(429), "UNKNOWN", "429 should be UNKNOWN");
  console.log("  ✔ HTTP 403 / 429 classified as UNKNOWN (bot protection)");

  // Restricted portal (401)
  assert.strictEqual(healthMonitor.classifyStatus(401), "UNKNOWN", "401 should be UNKNOWN");
  console.log("  ✔ HTTP 401 classified as UNKNOWN (restricted)");

  // Simulated DNS failure
  assert.strictEqual(healthMonitor.classifyStatus(null, "ENOTFOUND"), "DOWN", "DNS error ENOTFOUND should be DOWN");
  assert.strictEqual(healthMonitor.classifyStatus(null, "EAI_AGAIN"), "DOWN", "DNS error EAI_AGAIN should be DOWN");
  console.log("  ✔ DNS errors classified as DOWN");

  // Simulated Connection timeout
  assert.strictEqual(healthMonitor.classifyStatus(null, "ETIMEDOUT"), "DOWN", "ETIMEDOUT should be DOWN");
  assert.strictEqual(healthMonitor.classifyStatus(null, "ECONNABORTED"), "DOWN", "ECONNABORTED should be DOWN");
  console.log("  ✔ Connection timeouts classified as DOWN");

  // 2. Mocked company checks and retry behavior
  console.log("\n[Test 2] Retry Handling and Result Structure:");
  
  // Save original checkPortalUrl
  const originalCheckPortalUrl = healthMonitor.checkPortalUrl.bind(healthMonitor);

  // Mock a failing portal that succeeds on retry
  let attempt = 0;
  healthMonitor.checkPortalUrl = async (url) => {
    attempt++;
    if (attempt === 1) {
      return {
        status: "DOWN",
        httpStatusCode: 503,
        responseTimeMs: 120,
        errorMessage: "Temporary Service Unavailable"
      };
    }
    return {
      status: "UP",
      httpStatusCode: 200,
      responseTimeMs: 180,
      errorMessage: null
    };
  };

  const testCompany = {
    id: 9999,
    name: "Mock Company",
    careersUrl: "https://example.com/careers"
  };

  const resultWithRetry = await healthMonitor.checkCompany(testCompany);
  assert.strictEqual(resultWithRetry.status, "UP", "Transient failure should be recovered by retry");
  assert.strictEqual(attempt, 2, "Should have performed exactly 2 attempts (initial + retry)");
  console.log("  ✔ Temporary failure recovered on retry");

  // Mock persistent outage
  healthMonitor.checkPortalUrl = async (url) => {
    return {
      status: "DOWN",
      httpStatusCode: 500,
      responseTimeMs: 90,
      errorMessage: "Server Error"
    };
  };

  const resultPersistentDown = await healthMonitor.checkCompany(testCompany);
  assert.strictEqual(resultPersistentDown.status, "DOWN", "Persistent error should result in DOWN");
  assert.strictEqual(resultPersistentDown.consecutiveFailures >= 1, true, "consecutiveFailures should increment");
  console.log("  ✔ Persistent outage recorded as DOWN with failure count increment");

  // Restore original method
  healthMonitor.checkPortalUrl = originalCheckPortalUrl;

  // 3. Persistence Verification
  console.log("\n[Test 3] JSON Persistence:");
  healthMonitor.saveResults();
  const resultsPath = path.join(__dirname, "../data/monitoringResults.json");
  assert.strictEqual(fs.existsSync(resultsPath), true, "monitoringResults.json must exist on disk");
  
  const savedData = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  assert.strictEqual(typeof savedData.summary, "object", "Summary must exist in file");
  assert.strictEqual(Array.isArray(savedData.results), true, "Results must be an array in file");
  console.log("  ✔ Monitoring data successfully persisted to disk");

  // 4. API Status Payload Format
  console.log("\n[Test 4] Status Payload Format:");
  const statusPayload = healthMonitor.getStatus();
  assert.strictEqual(typeof statusPayload.summary.totalMonitored, "number", "totalMonitored is a number");
  assert.strictEqual(typeof statusPayload.summary.up, "number", "up count is a number");
  assert.strictEqual(typeof statusPayload.summary.down, "number", "down count is a number");
  assert.strictEqual(typeof statusPayload.summary.unknown, "number", "unknown count is a number");
  console.log("  ✔ Status payload matches required summary schema");

  console.log("\n==========================================");
  console.log("ALL TESTS PASSED SUCCESSFULLY! (100% PASS)");
  console.log("==========================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
