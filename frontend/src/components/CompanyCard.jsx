import React, { useState } from "react";
import "../styles/CompanyCard.css";

function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const CompanyCard = ({ company }) => {
  const [imgError, setImgError] = useState(false);

  // Reliable, high-res 128px official favicon service from Google
  const logoUrl = company.logo || (company.domain 
    ? `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${company.domain}&size=128`
    : null
  );

  return (
    <a
      href={company.careersUrl || "#"}
      className="company-card"
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${company.name} Official Careers Portal`}
      onClick={(e) => {
        if (!company.careersUrl) {
          e.preventDefault();
        }
      }}
    >
      <div className="card-logo-wrapper">
        {!imgError && logoUrl ? (
          <img
            src={logoUrl}
            alt={`${company.name} logo`}
            className="company-logo"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="logo-fallback" aria-label={company.name}>
            {getInitials(company.name)}
          </div>
        )}
      </div>

      <div className="card-info">
        <div className="card-name-row">
          <span className="company-name">{company.name}</span>
          <span className="external-icon" aria-hidden="true">↗</span>
        </div>
        <span className="company-tag">Official Careers</span>
      </div>
    </a>
  );
};

export default CompanyCard;
