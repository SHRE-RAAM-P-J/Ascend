/**
 * server.test.js
 * Integration test for Ascend Express 5 Server routing & middleware
 */

const http = require("http");
const assert = require("assert");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.PORT = "5005"; // Use isolated test port

const app = require("../server");

function makeRequest(path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 5005,
        path,
        method
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
