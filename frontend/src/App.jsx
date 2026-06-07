import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "./components/Navbar";
import SearchBar from "./components/SearchBar";
import JobCard from "./components/JobCard";

function App() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");
  const filteredJobs = jobs.filter((job) =>
  job.title
    .toLowerCase()
    .includes(search.toLowerCase()) ||
  job.company
    .toLowerCase()
    .includes(search.toLowerCase())
  );
  useEffect(() => {
    axios
      .get("http://localhost:5000/jobs")
      .then((res) => setJobs(res.data))
      .catch((err) => console.log(err));
  }, []);

  return (
    <div>
      <Navbar />

      <SearchBar
        search={search}
        setSearch={setSearch}
      />
      {filteredJobs.length === 0 ? (
        <p>No opportunities found. Try another search term.</p>
      ) : (
        <p>{filteredJobs.length === 1 ? "1 job" : `${filteredJobs.length} jobs`} found</p>
      )}     
      {filteredJobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
        />
      ))}
    </div>
  );
}

export default App;