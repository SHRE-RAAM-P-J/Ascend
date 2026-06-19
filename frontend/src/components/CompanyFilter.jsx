function CompanyFilter({
  selectedCompany,
  setSelectedCompany,
  uniqueCompanies,
}) {
  return (
    <select
      value={selectedCompany}
      onChange={(e) =>
        setSelectedCompany(e.target.value)
      }
    >
    {uniqueCompanies.map((company) => (
      <option key={company} value={company}>
        {company}
      </option>
    ))}
    </select>
  );
}

export default CompanyFilter;