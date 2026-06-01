import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/jobs")
      .then((res) => setJobs(res.data))
      .catch((err) => console.log(err));
  }, []);

  return (
    <div>
      <h1>Ascend</h1>

      {jobs.map((job) => (
        <div key={job.id}>
          <h3>{job.title}</h3>
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
      ))}
    </div>
  );
}

export default App;