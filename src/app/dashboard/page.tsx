"use client";

import { useCallback, useEffect, useState } from "react";

type AssignedLead = {
  assignmentId: string;
  assignedAt: string;
  leadId: string;
  customerName: string;
  phone: string;
  city: string;
  serviceName: string;
};

type ProviderCard = {
  id: string;
  name: string;
  usedQuota: number;
  remainingQuota: number;
  assignedLeadsCount: number;
  assignedLeads: AssignedLead[];
};

type DashboardResponse = {
  providers?: ProviderCard[];
  error?: string;
};

export default function DashboardPage() {
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/providers-dashboard", { cache: "no-store" });
      const data = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        setError(data.error || "Unable to fetch dashboard data.");
        return;
      }

      setError("");
      setProviders(data.providers || []);
    } catch {
      setError("Network error while fetching dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetchTimer = setTimeout(() => {
      void fetchDashboard();
    }, 0);

    const interval = setInterval(() => {
      void fetchDashboard();
    }, 3000);

    return () => {
      clearTimeout(initialFetchTimer);
      clearInterval(interval);
    };
  }, [fetchDashboard]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-zinc-900">Provider Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">Auto-refreshes every 3 seconds.</p>

        {loading ? (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Loading providers...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && !error && providers.length === 0 ? (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            No providers found.
          </div>
        ) : null}

        {!loading && !error && providers.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <section key={provider.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <h2 className="text-base font-semibold text-zinc-900">{provider.name}</h2>

                <div className="mt-3 space-y-1 text-sm text-zinc-700">
                  <p>Remaining Quota: {provider.remainingQuota}</p>
                  <p>Used Quota: {provider.usedQuota}</p>
                  <p>Assigned Leads Count: {provider.assignedLeadsCount}</p>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-medium text-zinc-900">Assigned Leads</h3>
                  {provider.assignedLeads.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No leads assigned yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {provider.assignedLeads.map((lead) => (
                        <li key={lead.assignmentId} className="rounded border border-zinc-200 p-2 text-xs text-zinc-700">
                          <p className="font-medium text-zinc-900">{lead.customerName}</p>
                          <p>{lead.phone}</p>
                          <p>{lead.city}</p>
                          <p>{lead.serviceName}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
