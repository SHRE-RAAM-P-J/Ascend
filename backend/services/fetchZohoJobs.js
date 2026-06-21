const axios = require("axios");

async function fetchZohoJobs() {
  const response = await axios.get(
    "https://careers.zohocorp.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite&extra_fields=%5B%22Remote_Job%22%5D"
  );

  const jobs = response.data.data;

  return jobs.map((job) => ({
    id: job.id,
    title: job.Posting_Title,
    company: "Zoho",
    location: job.Country1,
    type: job.Job_Type,
    applyUrl: job.$url,
    description: job.Job_Description,
  }));
}

module.exports = fetchZohoJobs;