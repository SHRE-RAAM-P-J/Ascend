function CompanyFilter({
  selectedCompany,
  setSelectedCompany
}) {
  return (
    <select
      value={selectedCompany}
      onChange={(e) =>
        setSelectedCompany(e.target.value)
      }
    >
      <option value="All">All Companies</option>
      <option value="Google">Google</option>
      <option value="Microsoft">Microsoft</option>
      <option value="Amazon">Amazon</option>
      <option value="Zoho">Zoho</option>
    </select>
  );
}

export default CompanyFilter;