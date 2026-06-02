function JobCard({ job }) {
  return (
    <div>
      <h2>{job.title}</h2>

      <p>{job.company}</p>

      <p>{job.location}</p>

      <a
        href={job.applyLink}
        target="_blank"
        rel="noreferrer"
      >
        Apply
      </a>

      <hr />
    </div>
  );
}

export default JobCard;