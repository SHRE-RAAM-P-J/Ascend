const axios = require("axios");
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchMicrosoftJobs() {
  let allJobs = [];
  let start = 0;

  while (true) {
    const response = await axios.get(
      `https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=&location=&start=${start}&sort_by=timestamp&`
    );

    const jobs = response.data.data.positions;

    console.log(`Fetched ${jobs.length} jobs at start=${start}`);

    if (jobs.length === 0) break;

    allJobs.push(...jobs);

    start += 20;
    await sleep(100);
  }

  return allJobs.map((job) => ({
    id: job.displayJobId,
    title: job.name,
    company: "Microsoft",
    location: job.locations[0] || "Unknown",
    department: job.department,
    applyUrl:
      "https://apply.careers.microsoft.com" + job.positionUrl,
  }));
}

module.exports = fetchMicrosoftJobs;