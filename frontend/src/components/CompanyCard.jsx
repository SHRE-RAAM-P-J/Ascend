import { useState } from "react";
import { formatRelativeTime } from "../utils/timeAgo";
import "../styles/CompanyCard.css";

function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const CompanyCard = ({ company, monitoring }) => {
  const [imgError, setImgError] = useState(false);

  // Status computation
  const status = monitoring?.status || "UNKNOWN";
  const lastCheckedAt = monitoring?.lastCheckedAt || null;
  const timeText = formatRelativeTime(lastCheckedAt);

  // Status icon configuration
  const statusConfig = {
    UP: {
      icon: "↑",
      label: "UP",
      className: "status-up"
    },
    DOWN: {
      icon: "↓",
      label: "DOWN",
      className: "status-down"
    },
    UNKNOWN: {
      icon: "●",
      label: "UNKNOWN",
      className: "status-unknown"
    }
  };

  const currentStatus = statusConfig[status] || statusConfig.UNKNOWN;

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
      title={`Open ${company.name} Official Careers Portal (Status: ${currentStatus.label})`}
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

        {/* Status indicator row below company name */}
        <div className="card-status-row">
          <span className={`status-pill ${currentStatus.className}`}>
            <span className="status-arrow" aria-hidden="true">{currentStatus.icon}</span>
            <span className="status-text">{currentStatus.label}</span>
          </span>
          <span className="status-timestamp">{timeText}</span>
        </div>
      </div>
    </a>
  );
};

export default CompanyCard;
