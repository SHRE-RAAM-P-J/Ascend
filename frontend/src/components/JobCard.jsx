import "../styles/JobCard.css";

function JobCard({ job }) {
  return (
    <div className="job-card">
      <h2>{job.title}</h2>

      <p>{job.company}</p>

      <p>{job.location}</p>

      <a
        className="apply-btn"
        href={job.applyLink}
        target="_blank"
        rel="noreferrer"
      >
        Apply
      </a>
    </div>
  );
}

export default JobCard;