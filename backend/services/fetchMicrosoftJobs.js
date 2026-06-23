const axios = require("axios");

async function fetchMicrosoftJobs() {
  const response = await axios.get(
    "https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=&location=&start=0&sort_by=timestamp&"
  );

  const jobs = response.data.data.positions;

  return jobs.map((job) => ({
    id: job.displayJobId,
    title: job.name,
    company: "Microsoft",
    location: job.locations[0] || "Unknown",
    department: job.department,
    applyUrl:
      "https://apply.careers.microsoft.com" +
      job.positionUrl,
  }));
}

module.exports = fetchMicrosoftJobs;