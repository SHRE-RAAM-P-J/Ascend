const express = require("express");
const router = express.Router();
const healthMonitor = require("../services/healthMonitor");

/**
 * GET /api/monitoring/status
 * Read-only endpoint returning current health status of all monitored companies
 * and aggregate summary.
 */
router.get("/status", (req, res) => {
  try {
    const data = healthMonitor.getStatus();
    res.json(data);
  } catch (error) {
    console.error("[MonitoringRoute] Failed to retrieve status:", error);
    res.status(500).json({ error: "Failed to retrieve monitoring status" });
  }
});

module.exports = router;
