/**
 * db/client.js
 * PostgreSQL connection pool for Ascend.
 *
 * Reads DATABASE_URL from the environment.
 * In local development, load with: node --env-file=.env server.js
 * On Vercel, DATABASE_URL is set as an environment variable in the dashboard.
 *
 * Uses Supabase transaction-pooler port (6543) which is compatible with
 * serverless/stateless connection patterns on Vercel.
 */

"use strict";

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  // Warn loudly in dev, but don't crash — JSON fallback still works for local dev
  // without a DB configured.
  console.warn(
    "[DB] DATABASE_URL is not set. Database features will be unavailable. " +
    "For local dev: start with `node --env-file=.env server.js`"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase transaction pooler (port 6543) requires SSL
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
  // Vercel serverless: keep pool small — each function invocation is short-lived
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

module.exports = pool;
