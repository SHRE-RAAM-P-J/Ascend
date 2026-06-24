const axios = require("axios");

async function fetchMicrosoftJobs() {
  let allJobs = [];
  for (let start = 0; start <= 200; start += 20) {
  // fetch
  // push into allJobs
  const response = await axios.get(
    `https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=&location=&start=${start}&sort_by=timestamp&`
  );
  allJobs.push(...response.data.data.positions);
  }
  return allJobs.map((job) => ({
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