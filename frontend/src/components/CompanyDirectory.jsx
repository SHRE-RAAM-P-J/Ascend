import React, { useState, useEffect } from "react";
import axios from "axios";
import { companies } from "../data/companyData";
import CompanyCard from "./CompanyCard";
import "../styles/CompanyDirectory.css";

const MONITORING_API_URL = "http://localhost:5000/api/monitoring/status";
const STATUS_POLL_INTERVAL_MS = 60000; // Refresh from backend every 60s
const CLOCK_TICK_INTERVAL_MS = 30000;   // Refresh human-readable times every 30s

const CompanyDirectory = () => {
  // Filter out disabled companies (KPIT is temporarily excluded per requirement)
  const visibleCompanies = companies.filter((c) => c.enabled !== false);

  const [monitoringMap, setMonitoringMap] = useState({});
  const [summary, setSummary] = useState(null);
  const [, setTick] = useState(0);

  // Fetch monitoring results from backend API
  const fetchMonitoringStatus = async () => {
    try {
      const response = await axios.get(MONITORING_API_URL, { timeout: 8000 });
      if (response.data && Array.isArray(response.data.results)) {
        const map = {};
        response.data.results.forEach((item) => {
          map[item.companyId] = item;
        });
        setMonitoringMap(map);
        if (response.data.summary) {
          setSummary(response.data.summary);
        }
      }
    } catch (err) {
      // Backend may be offline or starting up; graceful fallback maintains UI integrity
      console.warn("[CompanyDirectory] Monitoring API offline or unreachable:", err.message);
    }
  };

  useEffect(() => {
    // Initial fetch on mount
    fetchMonitoringStatus();

    // Periodic poll from backend API
    const apiInterval = setInterval(() => {
      fetchMonitoringStatus();
    }, STATUS_POLL_INTERVAL_MS);

    // Periodic re-render to update relative time calculations ("Checked 2 minutes ago")
    const clockInterval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, CLOCK_TICK_INTERVAL_MS);

    return () => {
      clearInterval(apiInterval);
      clearInterval(clockInterval);
    };
  }, []);

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
            {summary && summary.up > 0 ? (
              <span className="stats-pill live-stats">
                <span className="stat-up">↑ {summary.up} UP</span>
                {summary.down > 0 && <span className="stat-down"> · ↓ {summary.down} DOWN</span>}
              </span>
            ) : (
              <span className="stats-pill">{visibleCompanies.length} Verified Portals</span>
            )}
          </div>
        </div>

        {/* Company Grid (Responsive: 5-col Desktop, 3-col Tablet, 2-col Mobile) */}
        <div className="company-grid">
          {visibleCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              monitoring={monitoringMap[company.id]}
            />
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
