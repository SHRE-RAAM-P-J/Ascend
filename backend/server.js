const express = require("express");
const cors = require("cors");
const jobs = require("./data/jobs.json");

const app = express();

app.use(cors());

app.get("/jobs", (req, res) => {
  res.json(jobs);
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});