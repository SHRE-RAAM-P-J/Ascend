import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "./components/Navbar";
import SearchBar from "./components/SearchBar";
import JobCard from "./components/JobCard";
import CompanyFilter from "./components/CompanyFilter";

function App() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("All");
  const filteredJobs = jobs.filter((job) =>{
  const matchesSearch =
  job.title
    .toLowerCase()
    .includes(search.toLowerCase()) ||
  job.company
    .toLowerCase()
    .includes(search.toLowerCase());

  const matchesCompany =
    selectedCompany === "All" ||
    job.company === selectedCompany;

  return matchesSearch && matchesCompany;
  });

  useEffect(() => {
    axios
      .get("http://localhost:5000/jobs")
      .then((res) => setJobs(res.data))
      .catch((err) => console.log(err));
  }, []);
  const uniqueCompanies = [
    "All",
    ...new Set(jobs.map((job) => job.company)),
  ];

  return (
    <div>
      <Navbar />

      <SearchBar
        search={search}
        setSearch={setSearch}
      />
      <CompanyFilter
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        uniqueCompanies={uniqueCompanies}
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