const express = require("express");
const cors = require("cors");
const jobs = require("./data/jobs.json");
const fetchZohoJobs = require("./services/fetchZohoJobs");
const app = express();

app.use(cors());

app.get("/jobs", async (req, res) => {
  try {
    const jobs = await fetchZohoJobs();
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch jobs",
    });
  }
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});