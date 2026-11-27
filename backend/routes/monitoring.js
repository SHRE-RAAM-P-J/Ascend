/**
 * routes/monitoring.js
 * Endpoints for Ascend Career Portal Health Monitoring and On-Demand Batch Refresh.
 */

"use strict";

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const healthMonitor = require("../services/healthMonitor");
const monitoringStore = require("../db/monitoringStore");

const UUID_REGEX = /^[0-9a-fA-F-]{8,36}$/;
const BATCH_SIZE = 10;

// Rate limiter for initiating a refresh run (max 2 per minute per IP)
const refreshTriggerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Refresh rate limit exceeded. Please wait 60 seconds before initiating another refresh." }
});

/**
 * GET /api/monitoring/status
 * Read-only endpoint returning current health status of all monitored companies
 * and aggregate summary. Does NOT trigger any outbound health checks.
 */
router.get("/status", async (req, res) => {
  try {
    const data = await monitoringStore.getStatus();
    res.json(data);
  } catch (error) {
    console.error("[MonitoringRoute] Failed to retrieve status:", error.message);
    res.status(500).json({ error: "Failed to retrieve monitoring status" });
  }
});

/**
 * POST /api/monitoring/refresh
 * Initiates an on-demand monitoring run across all enabled companies.
 * Returns existing job if one is already running, or creates a new job.
 */
router.post("/refresh", refreshTriggerLimiter, async (req, res) => {
  try {
    // 1. Check if an active job is already in progress
    const activeJob = await monitoringStore.getActiveJob();
    if (activeJob) {
      return res.status(202).json({
        jobId: activeJob.id,
        status: activeJob.status,
        message: "A monitoring refresh is already in progress",
        totalCompanies: activeJob.totalCompanies,
        processedCompanies: activeJob.processedCompanies,
        resumed: true
      });
    }

    // 2. Snapshot enabled companies
    const enabledCompanies = healthMonitor.getEnabledCompanies();
    if (!enabledCompanies || enabledCompanies.length === 0) {
      return res.status(400).json({ error: "No enabled companies found to monitor" });
    }

    // 3. Create new job
    const newJob = await monitoringStore.createJob(enabledCompanies);

    res.status(202).json({
      jobId: newJob.id,
      status: newJob.status,
      message: "Monitoring refresh job initiated successfully",
      totalCompanies: newJob.totalCompanies,
      processedCompanies: 0,
      resumed: false
    });
  } catch (error) {
    console.error("[MonitoringRoute] Failed to start refresh:", error.message);
    res.status(500).json({ error: "Failed to initiate monitoring refresh" });
  }
});

/**
 * POST /api/monitoring/refresh/:jobId/next
 * Serverless-compatible batch processing endpoint.
 * Processes the next batch of companies for the given job.
 */
router.post("/refresh/:jobId/next", async (req, res) => {
  const { jobId } = req.params;

  if (!UUID_REGEX.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId parameter format" });
  }

  try {
    // 1. Check job state
    const job = await monitoringStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Monitoring job not found" });
    }

    if (job.status === "completed") {
      return res.json({
        completed: true,
        status: "completed",
        totalCompanies: job.totalCompanies,
        processedCompanies: job.processedCompanies,
        progressPercent: 100
      });
    }

    if (job.status === "cancelled" || job.status === "failed") {
      return res.status(410).json({
        completed: true,
        status: job.status,
        message: `Job is ${job.status}`
      });
    }

    // 2. Acquire batch lease
    const leasedJob = await monitoringStore.acquireBatchLease(jobId, 25000);
    if (!leasedJob) {
      return res.status(409).json({
        error: "Batch lease is currently active. Another invocation is processing or lease not yet expired.",
        retryAfterMs: 3000
      });
    }

    // 3. Extract snapshot and next batch
    let snapshot = leasedJob.companySnapshot;
    if (typeof snapshot === "string") {
      snapshot = JSON.parse(snapshot);
    }

    const offset = leasedJob.nextOffset || 0;
    const batch = snapshot.slice(offset, offset + BATCH_SIZE);

    if (batch.length === 0) {
      // Reached end of company list
      await monitoringStore.updateJobProgress(jobId, {
        processedCompanies: leasedJob.totalCompanies,
        nextOffset: leasedJob.totalCompanies,
        status: "completed",
        completedAt: new Date().toISOString()
      });

      return res.json({
        completed: true,
        status: "completed",
        totalCompanies: leasedJob.totalCompanies,
        processedCompanies: leasedJob.totalCompanies,
        progressPercent: 100
      });
    }

    // 4. Run batch health checks
    const existingResultMap = await monitoringStore.getExistingResultMap();
    const batchResults = await healthMonitor.checkBatch(batch, existingResultMap);

    // 5. Persist results to DB
    await monitoringStore.upsertResultsBatch(batchResults);

    // 6. Update progress
    const newProcessed = leasedJob.processedCompanies + batch.length;
    const newOffset = offset + batch.length;
    const isCompleted = newOffset >= leasedJob.totalCompanies;

    await monitoringStore.updateJobProgress(jobId, {
      processedCompanies: newProcessed,
      nextOffset: newOffset,
      status: isCompleted ? "completed" : "pending",
      completedAt: isCompleted ? new Date().toISOString() : null
    });

    res.json({
      completed: isCompleted,
      status: isCompleted ? "completed" : "running",
      totalCompanies: leasedJob.totalCompanies,
      processedCompanies: newProcessed,
      batchSize: batch.length,
      progressPercent: Math.min(100, Math.round((newProcessed / leasedJob.totalCompanies) * 100))
    });
  } catch (error) {
    console.error("[MonitoringRoute] Batch processing error:", error.message);
    // Immediately release the lease and log error so subsequent attempts can recover
    await monitoringStore.recordBatchFailure(jobId, error.message).catch(() => {});
    res.status(500).json({ error: "Failed to process monitoring batch", details: error.message });
  }
});

/**
 * GET /api/monitoring/cron and POST /api/monitoring/cron
 * Scheduled hourly cron endpoint compatible with Vercel Cron Jobs and external webhooks.
 * Protected by CRON_SECRET environment variable when set.
 * Iterates through batches within a safe execution time budget (~45 seconds).
 */
const handleCronTrigger = async (req, res) => {
  // 1. Authorization check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const queryKey = req.query.key;

    if (bearerToken !== cronSecret && queryKey !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized: Invalid CRON_SECRET" });
    }
  }

  try {
    // 2. Retrieve or create active job
    let job = await monitoringStore.getActiveJob();
    if (!job) {
      const enabledCompanies = healthMonitor.getEnabledCompanies();
      if (!enabledCompanies || enabledCompanies.length === 0) {
        return res.status(400).json({ error: "No enabled companies found to monitor" });
      }
      job = await monitoringStore.createJob(enabledCompanies);
    }

    const startTime = Date.now();
    const MAX_DURATION_MS = 45000; // 45-second budget to prevent gateway timeouts
    let batchesProcessed = 0;
    let isCompleted = false;

    // 3. Process batches until completed or time budget reached
    while (Date.now() - startTime < MAX_DURATION_MS) {
      const leasedJob = await monitoringStore.acquireBatchLease(job.id, 25000);
      if (!leasedJob) {
        // Lease currently held by another worker; break to prevent conflict
        break;
      }

      let snapshot = leasedJob.companySnapshot;
      if (typeof snapshot === "string") {
        snapshot = JSON.parse(snapshot);
      }

      const offset = leasedJob.nextOffset || 0;
      const batch = snapshot.slice(offset, offset + BATCH_SIZE);

      if (batch.length === 0) {
        await monitoringStore.updateJobProgress(job.id, {
          processedCompanies: leasedJob.totalCompanies,
          nextOffset: leasedJob.totalCompanies,
          status: "completed",
          completedAt: new Date().toISOString()
        });
        isCompleted = true;
        break;
      }

      const existingResultMap = await monitoringStore.getExistingResultMap();
      const batchResults = await healthMonitor.checkBatch(batch, existingResultMap);
      await monitoringStore.upsertResultsBatch(batchResults);

      const newProcessed = leasedJob.processedCompanies + batch.length;
      const newOffset = offset + batch.length;
      isCompleted = newOffset >= leasedJob.totalCompanies;

      await monitoringStore.updateJobProgress(job.id, {
        processedCompanies: newProcessed,
        nextOffset: newOffset,
        status: isCompleted ? "completed" : "pending",
        completedAt: isCompleted ? new Date().toISOString() : null
      });

      batchesProcessed++;
      if (isCompleted) break;
    }

    res.json({
      success: true,
      jobId: job.id,
      completed: isCompleted,
      batchesProcessed,
      elapsedMs: Date.now() - startTime,
      message: isCompleted
        ? "Scheduled health check completed successfully"
        : "Batches processed within time budget; remaining batches will continue on next schedule"
    });
  } catch (error) {
    console.error("[MonitoringRoute] Cron trigger error:", error.message);
    res.status(500).json({ error: "Failed to execute scheduled health check", details: error.message });
  }
};

router.get("/cron", handleCronTrigger);
router.post("/cron", handleCronTrigger);

/**
 * GET /api/monitoring/refresh/:jobId
 * Check current progress and state of an existing monitoring job.
 */
router.get("/refresh/:jobId", async (req, res) => {
  const { jobId } = req.params;

  if (!UUID_REGEX.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId parameter format" });
  }

  try {
    const job = await monitoringStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Monitoring job not found" });
    }

    const progressPercent = job.totalCompanies > 0
      ? Math.min(100, Math.round((job.processedCompanies / job.totalCompanies) * 100))
      : 0;

    res.json({
      id: job.id,
      status: job.status,
      totalCompanies: job.totalCompanies,
      processedCompanies: job.processedCompanies,
      progressPercent,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      lastError: job.lastError
    });
  } catch (error) {
    console.error("[MonitoringRoute] Failed to fetch job status:", error.message);
    res.status(500).json({ error: "Failed to retrieve job status" });
  }
});

/**
 * POST /api/monitoring/refresh/:jobId/cancel
 * Cancel an active or pending monitoring job.
 */
router.post("/refresh/:jobId/cancel", async (req, res) => {
  const { jobId } = req.params;

  if (!UUID_REGEX.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId parameter format" });
  }

  try {
    const cancelled = await monitoringStore.cancelJob(jobId);
    if (!cancelled) {
      return res.status(404).json({ error: "Job not found or already completed/cancelled" });
    }

    res.json({ success: true, message: "Job cancelled successfully" });
  } catch (error) {
    console.error("[MonitoringRoute] Failed to cancel job:", error.message);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

module.exports = router;
