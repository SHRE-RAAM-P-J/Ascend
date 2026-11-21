import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { companies } from "../data/companyData";
import CompanyCard from "./CompanyCard";
import "../styles/CompanyDirectory.css";

const API_BASE = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? "http://localhost:5000" : "");

const MONITORING_API_URL = `${API_BASE}/api/monitoring/status`;
const REFRESH_API_URL = `${API_BASE}/api/monitoring/refresh`;
const CLOCK_TICK_INTERVAL_MS = 30000;

const CompanyDirectory = () => {
  const visibleCompanies = companies.filter((c) => c.enabled !== false);

  const [monitoringMap, setMonitoringMap] = useState({});
  const [summary, setSummary] = useState(null);
  const [, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // On-demand refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const isMountedRef = useRef(true);

  // Fetch the latest saved monitoring results (read-only, does NOT execute checks)
  const fetchStatus = async () => {
    try {
      const response = await axios.get(MONITORING_API_URL, { timeout: 8000 });
      if (!isMountedRef.current) return;
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
      if (isMountedRef.current) {
        console.warn("[CompanyDirectory] Monitoring API status unreachable:", err.message);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    let isSubscribed = true;

    // Load initial saved results on mount asynchronously
    axios
      .get(MONITORING_API_URL, { timeout: 8000 })
      .then((response) => {
        if (!isSubscribed) return;
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
      })
      .catch((err) => {
        if (isSubscribed) {
          console.warn("[CompanyDirectory] Monitoring API status unreachable:", err.message);
        }
      });

    // Clock interval for updating relative time strings ("2 minutes ago")
    const clockInterval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, CLOCK_TICK_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      isSubscribed = false;
      clearInterval(clockInterval);
    };
  }, []);

  // Handler for On-Demand "Refresh Statuses" trigger
  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setRefreshError(null);
    setRefreshProgress({
      processed: 0,
      total: visibleCompanies.length,
      percent: 0,
      statusText: "Initiating refresh..."
    });

    try {
      // 1. Request a new or existing refresh job
      const startRes = await axios.post(REFRESH_API_URL, {}, { timeout: 10000 });
      const jobId = startRes.data.jobId;

      if (!jobId) {
        throw new Error("Failed to obtain a monitoring job ID from server");
      }

      const total = startRes.data.totalCompanies || visibleCompanies.length;
      let isCompleted = false;

      // 2. Loop through serverless batches until complete
      while (!isCompleted && isMountedRef.current) {
        try {
          const nextRes = await axios.post(`${REFRESH_API_URL}/${jobId}/next`, {}, { timeout: 35000 });
          const { completed, processedCompanies, totalCompanies, progressPercent } = nextRes.data;

          const currentProcessed = processedCompanies || total;
          const currentTotal = totalCompanies || total;
          const currentPercent = progressPercent !== undefined
            ? progressPercent
            : Math.min(100, Math.round((currentProcessed / currentTotal) * 100));

          if (isMountedRef.current) {
            setRefreshProgress({
              processed: currentProcessed,
              total: currentTotal,
              percent: currentPercent,
              statusText: completed
                ? "Refresh complete"
                : `Checking portals (${currentProcessed}/${currentTotal})...`
            });
          }

          // Incrementally update cards in the UI as each batch finishes
          await fetchStatus();

          if (completed) {
            isCompleted = true;
          }
        } catch (batchErr) {
          // If 409 Conflict: another invocation holds the lease, wait 2 seconds and retry
          if (batchErr.response && batchErr.response.status === 409) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw batchErr;
        }
      }

      // Auto-clear progress badge after short delay
      setTimeout(() => {
        if (isMountedRef.current) {
          setRefreshProgress(null);
        }
      }, 4000);
    } catch (err) {
      console.error("[CompanyDirectory] Refresh failed:", err);
      if (isMountedRef.current) {
        const msg = err.response?.data?.error || err.message || "Failed to complete status refresh";
        setRefreshError(msg);
        setTimeout(() => {
          if (isMountedRef.current) setRefreshError(null);
        }, 6000);
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  const filteredCompanies = searchQuery.trim()
    ? visibleCompanies.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : visibleCompanies;

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
              <span className="stats-pill">{visibleCompanies.length} Portals</span>
            )}
          </div>
        </div>

        {/* Search & Actions Toolbar */}
        <div className="directory-toolbar">
          <div className="search-wrapper">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="text"
              className="directory-search"
              placeholder="Search companies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search companies"
            />
          </div>

          <span className="company-count-label">
            {filteredCompanies.length} of {visibleCompanies.length} companies
          </span>

          <div className="refresh-controls">
            {refreshProgress && (
              <div className="refresh-progress-badge">
                <span className="refresh-progress-bar">
                  <span
                    className="refresh-progress-fill"
                    style={{ width: `${refreshProgress.percent}%` }}
                  />
                </span>
                <span>{refreshProgress.statusText}</span>
              </div>
            )}

            {refreshError && (
              <div className="refresh-error-toast" title={refreshError}>
                {refreshError}
              </div>
            )}

            <button
              type="button"
              className="refresh-button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Initiate on-demand health check across all career portals"
            >
              <span className={`refresh-icon ${isRefreshing ? "spinning" : ""}`} aria-hidden="true">
                ⟳
              </span>
              <span>{isRefreshing ? "Refreshing..." : "Refresh Statuses"}</span>
            </button>
          </div>
        </div>

        {/* Company Grid */}
        <div className="company-grid">
          {filteredCompanies.length > 0 ? (
            filteredCompanies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                monitoring={monitoringMap[company.id]}
              />
            ))
          ) : (
            <div className="no-results">No companies match &ldquo;{searchQuery}&rdquo;</div>
          )}
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
