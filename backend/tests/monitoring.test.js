/**
 * monitoring.test.js
 * Test suite for Ascend Health Monitoring Service
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { HealthMonitor } = require("../services/healthMonitor");
const { validateSafeUrl } = require("../utils/ssrfValidator");

const TEST_RESULTS_FILE = path.join(__dirname, "../data/monitoringResults.test.json");

async function runTests() {
  console.log("==========================================");
  console.log("Running Ascend Health Monitor Test Suite");
  console.log("==========================================");

  // Clean test file if present
  if (fs.existsSync(TEST_RESULTS_FILE)) {
    fs.unlinkSync(TEST_RESULTS_FILE);
  }

  // Create isolated HealthMonitor instance for testing
  const testMonitor = new HealthMonitor({
    resultsFile: TEST_RESULTS_FILE
  });

  // 1. Status classification tests
  console.log("\n[Test 1] Status Classification Logic:");
  
  // Working website (200 OK)
  assert.strictEqual(testMonitor.classifyStatus(200), "UP", "200 should be UP");
  assert.strictEqual(testMonitor.classifyStatus(204), "UP", "204 should be UP");
  console.log("  ✔ HTTP 2xx classified as UP");

  // Redirect (301, 302, 307, 308)
  assert.strictEqual(testMonitor.classifyStatus(301), "UP", "301 should be UP");
  assert.strictEqual(testMonitor.classifyStatus(302), "UP", "302 should be UP");
  console.log("  ✔ HTTP 3xx classified as UP (redirected)");

  // Server error (500, 502, 503)
  assert.strictEqual(testMonitor.classifyStatus(500), "DOWN", "500 should be DOWN");
  assert.strictEqual(testMonitor.classifyStatus(503), "DOWN", "503 should be DOWN");
  console.log("  ✔ HTTP 5xx classified as DOWN");

  // Client dead link (404)
  assert.strictEqual(testMonitor.classifyStatus(404), "DOWN", "404 should be DOWN");
  console.log("  ✔ HTTP 404 classified as DOWN");

  // Bot protection / Rate limit (403, 429) -> UNKNOWN (Never false DOWN)
  assert.strictEqual(testMonitor.classifyStatus(403), "UNKNOWN", "403 should be UNKNOWN");
  assert.strictEqual(testMonitor.classifyStatus(429), "UNKNOWN", "429 should be UNKNOWN");
  console.log("  ✔ HTTP 403 / 429 classified as UNKNOWN (bot protection)");

  // Restricted portal (401)
  assert.strictEqual(testMonitor.classifyStatus(401), "UNKNOWN", "401 should be UNKNOWN");
  console.log("  ✔ HTTP 401 classified as UNKNOWN (restricted)");

  // Simulated DNS failure
  assert.strictEqual(testMonitor.classifyStatus(null, "ENOTFOUND"), "DOWN", "DNS error ENOTFOUND should be DOWN");
  assert.strictEqual(testMonitor.classifyStatus(null, "EAI_AGAIN"), "DOWN", "DNS error EAI_AGAIN should be DOWN");
  console.log("  ✔ DNS errors classified as DOWN");

  // Simulated Connection timeout
  assert.strictEqual(testMonitor.classifyStatus(null, "ETIMEDOUT"), "DOWN", "ETIMEDOUT should be DOWN");
  assert.strictEqual(testMonitor.classifyStatus(null, "ECONNABORTED"), "DOWN", "ECONNABORTED should be DOWN");
  console.log("  ✔ Connection timeouts classified as DOWN");

  // 2. SSRF Protection Tests
  console.log("\n[Test 2] SSRF Protection Validation:");
  assert.strictEqual(validateSafeUrl("http://localhost:5000").safe, false, "Localhost must be blocked");
  assert.strictEqual(validateSafeUrl("http://127.0.0.1:8080").safe, false, "127.0.0.1 loopback must be blocked");
  assert.strictEqual(validateSafeUrl("http://169.254.169.254/latest/meta-data/").safe, false, "AWS metadata IP must be blocked");
  assert.strictEqual(validateSafeUrl("http://10.0.0.1/admin").safe, false, "10.0.0.0/8 private IP must be blocked");
  assert.strictEqual(validateSafeUrl("http://192.168.1.1").safe, false, "192.168.0.0/16 private IP must be blocked");
  assert.strictEqual(validateSafeUrl("file:///etc/passwd").safe, false, "file:// protocol must be blocked");
  assert.strictEqual(validateSafeUrl("https://careers.google.com").safe, true, "Public HTTPS URL must be allowed");
  console.log("  ✔ SSRF Validator blocks internal/metadata addresses and non-HTTP protocols");

  // 3. Mocked company checks and retry behavior
  console.log("\n[Test 3] Retry Handling and Result Structure:");
  
  // Mock a failing portal that succeeds on retry
  let attempt = 0;
  testMonitor.checkPortalUrl = async () => {
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

  const resultWithRetry = await testMonitor.checkCompany(testCompany);
  assert.strictEqual(resultWithRetry.status, "UP", "Transient failure should be recovered by retry");
  assert.strictEqual(attempt, 2, "Should have performed exactly 2 attempts (initial + retry)");
  console.log("  ✔ Temporary failure recovered on retry");

  // Mock persistent outage
  testMonitor.checkPortalUrl = async () => {
    return {
      status: "DOWN",
      httpStatusCode: 500,
      responseTimeMs: 90,
      errorMessage: "Server Error"
    };
  };

  const resultPersistentDown = await testMonitor.checkCompany(testCompany);
  assert.strictEqual(resultPersistentDown.status, "DOWN", "Persistent error should result in DOWN");
  assert.strictEqual(resultPersistentDown.consecutiveFailures >= 1, true, "consecutiveFailures should increment");
  console.log("  ✔ Persistent outage recorded as DOWN with failure count increment");

  // 4. Persistence Verification (Isolated Test File)
  console.log("\n[Test 4] JSON Persistence & Test Data Isolation:");
  testMonitor.saveResults();
  assert.strictEqual(fs.existsSync(TEST_RESULTS_FILE), true, "monitoringResults.test.json must exist on disk");
  
  const savedData = JSON.parse(fs.readFileSync(TEST_RESULTS_FILE, "utf8"));
  assert.strictEqual(typeof savedData.summary, "object", "Summary must exist in file");
  assert.strictEqual(Array.isArray(savedData.results), true, "Results must be an array in file");
  console.log("  ✔ Monitoring data successfully persisted to isolated test file");

  // Verify production file is NOT polluted
  const prodResultsFile = path.join(__dirname, "../data/monitoringResults.json");
  if (fs.existsSync(prodResultsFile)) {
    const prodData = JSON.parse(fs.readFileSync(prodResultsFile, "utf8"));
    const mockInProd = prodData.results.find((r) => r.companyId === 9999);
    assert.strictEqual(mockInProd, undefined, "Production monitoring file must NOT contain mock company 9999");
    console.log("  ✔ Production monitoringResults.json remains completely unpolluted");
  }

  // 5. Batch Processing Method Verification
  console.log("\n[Test 5] Batch Processing Method (checkBatch):");
  const testBatch = [
    { id: 9901, name: "Batch Co 1", careersUrl: "https://example.com/c1" },
    { id: 9902, name: "Batch Co 2", careersUrl: "https://example.com/c2" }
  ];

  testMonitor.checkPortalUrl = async (url) => {
    return {
      status: url.includes("c1") ? "UP" : "UNKNOWN",
      httpStatusCode: url.includes("c1") ? 200 : 403,
      responseTimeMs: 80,
      errorMessage: null
    };
  };

  const existingMap = new Map();
  // Company 9902 was previously UP, should preserve UP status on UNKNOWN (403 bot block)
  existingMap.set(9902, { status: "UP", consecutiveFailures: 0 });

  const batchResults = await testMonitor.checkBatch(testBatch, existingMap);
  assert.strictEqual(batchResults.length, 2, "checkBatch should return 2 records");
  assert.strictEqual(batchResults.find((r) => r.companyId === 9901).status, "UP");
  assert.strictEqual(batchResults.find((r) => r.companyId === 9902).status, "UP", "Previous UP status should be preserved on 403 UNKNOWN");
  console.log("  ✔ checkBatch processes slices and preserves status continuity");

  // 6. Clean up temporary test file
  if (fs.existsSync(TEST_RESULTS_FILE)) {
    fs.unlinkSync(TEST_RESULTS_FILE);
  }
  const tmpFile = `${TEST_RESULTS_FILE}.tmp`;
  if (fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile);
  }

  console.log("\n==========================================");
  console.log("ALL TESTS PASSED SUCCESSFULLY! (100% PASS)");
  console.log("==========================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
