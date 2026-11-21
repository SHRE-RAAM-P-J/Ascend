/**
 * server.test.js
 * Integration test for Ascend Express 5 Server routing, middleware & batch monitoring endpoints
 */

const http = require("http");
const assert = require("assert");

process.env.NODE_ENV = "test";
process.env.PORT = "5005"; // Use isolated test port
// Isolate tests from external DB to prevent network timeouts during test suite
delete process.env.DATABASE_URL;

// Stub live external job scrapers for deterministic test suite execution
require.cache[require.resolve("../services/fetchMicrosoftJobs")] = {
  id: require.resolve("../services/fetchMicrosoftJobs"),
  filename: require.resolve("../services/fetchMicrosoftJobs"),
  loaded: true,
  exports: async () => [
    { id: "ms-1", title: "Software Engineer", company: "Microsoft", location: "Redmond", applyUrl: "https://careers.microsoft.com" }
  ]
};

require.cache[require.resolve("../services/fetchZohoJobs")] = {
  id: require.resolve("../services/fetchZohoJobs"),
  filename: require.resolve("../services/fetchZohoJobs"),
  loaded: true,
  exports: async () => [
    { id: "zh-1", title: "Frontend Developer", company: "Zoho", location: "Chennai", applyUrl: "https://careers.zohocorp.com" }
  ]
};

const app = require("../server");

function makeRequest(path, method = "GET", postData = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    let bodyPayload = "";
    if (postData) {
      bodyPayload = typeof postData === "string" ? postData : JSON.stringify(postData);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(bodyPayload);
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 5005,
        path,
        method,
        headers
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      }
    );
    req.on("error", reject);
    if (bodyPayload) {
      req.write(bodyPayload);
    }
    req.end();
  });
}

async function runServerTests() {
  console.log("==========================================");
  console.log("Running Express 5 Server Integration Tests");
  console.log("==========================================");

  const server = app.listen(5005);
  console.log("✔ Test server started on port 5005 without path-to-regexp errors");

  try {
    // 1. Test /api/monitoring/status
    console.log("\n[Test 1] GET /api/monitoring/status");
    const monitoringRes = await makeRequest("/api/monitoring/status");
    assert.strictEqual(monitoringRes.statusCode, 200, "Should return HTTP 200");
    assert(monitoringRes.headers["content-type"].includes("application/json"), "Should be application/json");
    const monitoringData = JSON.parse(monitoringRes.body);
    assert.strictEqual(typeof monitoringData.summary, "object", "Should have summary object");
    assert(Array.isArray(monitoringData.results), "Should have results array");
    console.log("  ✔ /api/monitoring/status returned 200 with JSON summary");

    // 2. Test unknown API endpoint returns JSON 404 (NOT HTML)
    console.log("\n[Test 2] GET /api/unknown-endpoint (JSON 404 test)");
    const unknownApiRes = await makeRequest("/api/unknown-endpoint");
    assert.strictEqual(unknownApiRes.statusCode, 404, "Should return HTTP 404");
    assert(unknownApiRes.headers["content-type"].includes("application/json"), "Should be application/json");
    const unknownApiData = JSON.parse(unknownApiRes.body);
    assert.strictEqual(unknownApiData.error, "API endpoint not found", "Should return JSON error");
    console.log("  ✔ Unknown API endpoint returned HTTP 404 with JSON error (not HTML)");

    // 3. Test React SPA fallback
    console.log("\n[Test 3] GET / (React SPA fallback)");
    const spaRes = await makeRequest("/");
    assert.strictEqual(spaRes.statusCode, 200, "Should return HTTP 200");
    assert(spaRes.headers["content-type"].includes("text/html"), "Should return text/html for SPA");
    assert(spaRes.body.includes("<div id=\"root\">"), "Should contain root div from index.html");
    console.log("  ✔ SPA route returned index.html for direct client entry");

    // 4. Test direct refresh on client SPA route (e.g. /companies)
    console.log("\n[Test 4] GET /companies (SPA direct refresh)");
    const spaDeepRes = await makeRequest("/companies");
    assert.strictEqual(spaDeepRes.statusCode, 200, "Should return HTTP 200");
    assert(spaDeepRes.headers["content-type"].includes("text/html"), "Should return text/html for client route");
    console.log("  ✔ SPA deep link returned index.html for client-side routing");

    // 5. Test security headers
    console.log("\n[Test 5] Security Headers (Helmet)");
    assert(spaRes.headers["x-content-type-options"] === "nosniff", "x-content-type-options should be nosniff");
    console.log("  ✔ Helmet security headers active on responses");

    // 6. Test POST /api/monitoring/refresh (Initiate on-demand monitoring)
    console.log("\n[Test 6] POST /api/monitoring/refresh");
    const refreshRes = await makeRequest("/api/monitoring/refresh", "POST", {});
    assert.strictEqual(refreshRes.statusCode, 202, "Should return 202 Accepted");
    const refreshData = JSON.parse(refreshRes.body);
    assert(refreshData.jobId, "Should return a jobId");
    assert.strictEqual(typeof refreshData.totalCompanies, "number", "Should report totalCompanies");
    console.log(`  ✔ Refresh initiated with jobId: ${refreshData.jobId}`);

    // 7. Test invalid Job ID format validation
    console.log("\n[Test 7] Invalid Job ID format validation");
    const invalidIdRes = await makeRequest("/api/monitoring/refresh/invalid;injection!/next", "POST", {});
    assert.strictEqual(invalidIdRes.statusCode, 400, "Should return 400 for malicious/malformed jobId");
    console.log("  ✔ Invalid Job ID parameter blocked with HTTP 400 Bad Request");

    // 8. Test GET /api/monitoring/refresh/:jobId
    console.log("\n[Test 8] GET /api/monitoring/refresh/:jobId");
    const jobStatusRes = await makeRequest(`/api/monitoring/refresh/${refreshData.jobId}`);
    assert.strictEqual(jobStatusRes.statusCode, 200, "Should return HTTP 200");
    const jobStatusData = JSON.parse(jobStatusRes.body);
    assert.strictEqual(jobStatusData.id, refreshData.jobId);
    console.log(`  ✔ Job status retrieved: status=${jobStatusData.status}, progress=${jobStatusData.progressPercent}%`);

    // 9. Test POST /api/monitoring/refresh/:jobId/cancel
    console.log("\n[Test 9] POST /api/monitoring/refresh/:jobId/cancel");
    const cancelRes = await makeRequest(`/api/monitoring/refresh/${refreshData.jobId}/cancel`, "POST", {});
    assert.strictEqual(cancelRes.statusCode, 200, "Should return HTTP 200");
    console.log("  ✔ Job cancellation verified");

    // 10. Test /jobs preserved integration endpoint
    console.log("\n[Test 10] GET /jobs (Zoho and Microsoft integration check)");
    const jobsRes = await makeRequest("/jobs");
    assert.strictEqual(jobsRes.statusCode, 200, "Should return HTTP 200");
    const jobsData = JSON.parse(jobsRes.body);
    assert(Array.isArray(jobsData), "Should return array of jobs");
    console.log(`  ✔ /jobs endpoint preserved and functional (returned ${jobsData.length} aggregated jobs)`);

    console.log("\n==========================================");
    console.log("ALL SERVER INTEGRATION TESTS PASSED! (100%)");
    console.log("==========================================\n");
  } finally {
    server.close();
  }
}

runServerTests().catch((err) => {
  console.error("Server Integration Tests Failed:", err);
  process.exit(1);
});
