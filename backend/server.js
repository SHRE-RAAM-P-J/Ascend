const express = require("express");
const cors = require("cors");

const fetchZohoJobs = require("./services/fetchZohoJobs");
const fetchMicrosoftJobs = require("./services/fetchMicrosoftJobs");
const monitoringRoutes = require("./routes/monitoring");
const healthMonitor = require("./services/healthMonitor");

const app = express();

app.use(cors());
app.use(express.json());

// Career portal health monitoring endpoint
app.use("/api/monitoring", monitoringRoutes);

// Preserved existing job aggregation endpoint
app.get("/jobs", async (req, res) => {
  try {
    const zohoJobs = await fetchZohoJobs();
    const microsoftJobs = await fetchMicrosoftJobs();

    const allJobs = [
      ...zohoJobs,
      ...microsoftJobs,
    ];

    res.json(allJobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch jobs",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the automated 60-minute health monitoring service
  healthMonitor.startScheduler(true);
});
