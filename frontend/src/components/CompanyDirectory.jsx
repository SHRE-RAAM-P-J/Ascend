import React from "react";
import { companies } from "../data/companyData";
import CompanyCard from "./CompanyCard";
import "../styles/CompanyDirectory.css";

const CompanyDirectory = () => {
  // Filter out any disabled companies (KPIT Technologies is temporarily excluded per requirements)
  const visibleCompanies = companies.filter((c) => c.enabled !== false);

  return (
    <div className="directory-wrapper">
      <div className="browser-container">
        {/* Browser Top Strip */}
        <div className="browser-header">
          <div className="browser-controls">
            <span className="browser-circle red" title="Close" />
            <span className="browser-circle yellow" title="Minimize" />
            <span className="browser-circle green" title="Expand" />
          </div>

          <div className="browser-address-bar">
            <span className="lock-icon" aria-hidden="true">🔒</span>
            <span className="address-text">ascend.directory/companies</span>
          </div>

          <div className="browser-stats">
            <span className="stats-pill">{visibleCompanies.length} Verified Portals</span>
          </div>
        </div>

        {/* Company Grid (Responsive: 5-col Desktop, 3-col Tablet, 2-col Mobile) */}
        <div className="company-grid">
          {visibleCompanies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>

        {/* Brand Signature */}
        <div className="directory-footer">
          <p className="brand-signature">
            Your Gateway to Opportunities <span className="sig-divider">|</span> Powered by <span className="sig-brand">Ascend</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompanyDirectory;
