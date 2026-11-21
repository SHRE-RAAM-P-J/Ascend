-- ====================================================================
-- Ascend Database Schema: Supabase / PostgreSQL
-- ====================================================================

-- 1. Table for persistent company career portal monitoring results
CREATE TABLE IF NOT EXISTS monitoring_results (
  company_id INTEGER PRIMARY KEY,
  company_name TEXT NOT NULL,
  careers_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('UP', 'DOWN', 'UNKNOWN')),
  http_status_code INTEGER,
  response_time_ms INTEGER,
  last_checked_at TIMESTAMPTZ,
  error_message TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on status for summary aggregations
CREATE INDEX IF NOT EXISTS idx_monitoring_results_status ON monitoring_results(status);

-- 2. Table for on-demand batch monitoring jobs
CREATE TABLE IF NOT EXISTS monitoring_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_companies INTEGER NOT NULL,
  processed_companies INTEGER NOT NULL DEFAULT 0,
  next_offset INTEGER NOT NULL DEFAULT 0,
  company_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on status and lease for active job lookups
CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_status_lease ON monitoring_jobs(status, lease_until);
