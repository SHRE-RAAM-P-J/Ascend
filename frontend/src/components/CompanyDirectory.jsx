// CompanyDirectory component – renders a browser‑window‑style container with a responsive grid of company cards.
import React from "react";
import { companies } from "../data/companies";
import "../styles/CompanyDirectory.css";

const CompanyDirectory = () => {
  return (
    <div className="browser-container">
      <div className="browser-header">
        <span className="browser-circle red" />
        <span className="browser-circle yellow" />
        <span className="browser-circle green" />
      </div>
      <div className="company-grid">
        {companies.map((c) => (
          <a
            key={c.name}
            href={c.url || "#"}
            className="company-card"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!c.url) {
                e.preventDefault();
                // Future: flag missing URL for manual review.
              }
            }}
          >
            <div className="card-content">
              <span className="company-name">{c.name}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default CompanyDirectory;
