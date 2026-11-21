/**
 * db/migrate.js
 * Database migration and initial data import for Ascend.
 *
 * Capabilities:
 *  1. Applies schema from db/schema.sql (monitoring_results and monitoring_jobs)
 *  2. Imports existing 140 monitoring results from backend/data/monitoringResults.json
 *  3. Idempotent: safe to run multiple times (uses ON CONFLICT)
 *  4. Supports --dry-run flag for offline verification without touching remote database
 */

"use strict";

const fs = require("fs");
const path = require("path");
const pool = require("./client");

const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const RESULTS_FILE = path.join(__dirname, "../data/monitoringResults.json");
const COMPANIES_FILE = path.join(__dirname, "../data/companies.json");

async function runMigration(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes("--dry-run");

  console.log("=================================================");
  console.log(`Ascend Database Migration [Mode: ${isDryRun ? "DRY-RUN (Simulated)" : "LIVE"}]`);
  console.log("=================================================");

  // 1. Verify source data files
  if (!fs.existsSync(COMPANIES_FILE)) {
    throw new Error(`Companies dataset not found at ${COMPANIES_FILE}`);
  }
  if (!fs.existsSync(RESULTS_FILE)) {
    throw new Error(`Monitoring results not found at ${RESULTS_FILE}`);
  }

  const companiesRaw = JSON.parse(fs.readFileSync(COMPANIES_FILE, "utf8"));
  const resultsRaw = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));

  const totalCompanies = companiesRaw.length;
  const enabledCompanies = companiesRaw.filter((c) => c.enabled !== false).length;
  const existingResults = (resultsRaw.results || []).filter(
    (r) => typeof r.companyId === "number" && r.companyId < 9000
  );

  console.log(`- Total registered companies: ${totalCompanies} (141 expected)`);
  console.log(`- Enabled companies: ${enabledCompanies} (140 expected)`);
  console.log(`- Existing monitoring results to import: ${existingResults.length} (140 expected)`);
  console.log(`- Summary in file: UP: ${resultsRaw.summary?.up}, DOWN: ${resultsRaw.summary?.down}, UNKNOWN: ${resultsRaw.summary?.unknown}`);

  if (isDryRun) {
    console.log("\n✔ Dry-run validation successful. No remote database modifications performed.");
    return {
      success: true,
      dryRun: true,
      totalCompanies,
      enabledCompanies,
      resultsToImport: existingResults.length
    };
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured in environment. Cannot execute live migration.");
  }

  // 2. Apply Schema
  console.log("\nApplying database schema from schema.sql...");
  const schemaSql = fs.readFileSync(SCHEMA_FILE, "utf8");
  await pool.query(schemaSql);
  console.log("✔ Schema applied successfully (monitoring_results, monitoring_jobs created/verified).");

  // 3. Import existing results
  console.log(`\nImporting ${existingResults.length} monitoring results into monitoring_results table...`);
  const client = await pool.connect();
  let importedCount = 0;

  try {
    await client.query("BEGIN");

    for (const r of existingResults) {
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
      importedCount++;
    }

    await client.query("COMMIT");
    console.log(`✔ Successfully imported/updated ${importedCount} records into monitoring_results.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // 4. Verify count in DB
  const verifyRes = await pool.query("SELECT COUNT(*) AS count FROM monitoring_results");
  console.log(`\nVerified database row count: ${verifyRes.rows[0].count} records in monitoring_results.`);
  console.log("=================================================");
  console.log("Migration complete!");
  console.log("=================================================");

  return {
    success: true,
    dryRun: false,
    importedCount: Number(verifyRes.rows[0].count)
  };
}

// Allow CLI execution
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err.message);
      process.exit(1);
    });
}

module.exports = { runMigration };
