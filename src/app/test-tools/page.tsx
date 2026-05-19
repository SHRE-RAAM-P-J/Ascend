"use client";

import { useState } from "react";

type ApiResponse = {
  message?: string;
  error?: string;
  logs?: string[];
  [key: string]: unknown;
};

export default function TestToolsPage() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [webhookTimes, setWebhookTimes] = useState(5);
  const [output, setOutput] = useState<string[]>([]);

  const appendOutput = (title: string, payload: ApiResponse) => {
    const lines = [
      `[${new Date().toLocaleTimeString()}] ${title}`,
      payload.message ? `Message: ${payload.message}` : "",
      payload.error ? `Error: ${payload.error}` : "",
      ...Object.entries(payload)
        .filter(([key]) => !["message", "error", "logs"].includes(key))
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
      ...(payload.logs ?? []),
      "------------------------------",
    ].filter(Boolean) as string[];

    setOutput((prev) => [...lines, ...prev].slice(0, 400));
  };

  async function runAction(actionKey: string, url: string, body: object) {
    setLoadingAction(actionKey);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiResponse;
      appendOutput(actionKey, payload);
    } catch {
      appendOutput(actionKey, { error: "Network error." });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Test Tools</h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              runAction("Reset Quotas", "/api/test-tools/webhook", {
                times: 1,
                idempotencyKey: `manual-reset-${Date.now()}`,
              })
            }
            disabled={loadingAction !== null}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 disabled:opacity-60"
          >
            {loadingAction === "Reset Quotas" ? "Running..." : "Reset All Quotas To 10"}
          </button>

          <button
            type="button"
            onClick={() => runAction("Generate Leads", "/api/test-tools/generate-leads", { count: 10 })}
            disabled={loadingAction !== null}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 disabled:opacity-60"
          >
            {loadingAction === "Generate Leads" ? "Running..." : "Generate 10 Leads Simultaneously"}
          </button>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="times" className="text-sm text-zinc-700">
              Webhook calls
            </label>
            <input
              id="times"
              type="number"
              min={1}
              max={50}
              value={webhookTimes}
              onChange={(event) => setWebhookTimes(Number(event.target.value))}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm sm:w-28"
            />
            <button
              type="button"
              onClick={() =>
                runAction("Webhook", "/api/test-tools/webhook", {
                  times: webhookTimes,
                })
              }
              disabled={loadingAction !== null}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 disabled:opacity-60"
            >
              {loadingAction === "Webhook" ? "Running..." : "Trigger Webhook Safely"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            All webhook attempts in one run share the same idempotency key.
          </p>
        </div>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">Logs / Output</h2>
          <div className="mt-3 h-80 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3">
            {output.length === 0 ? (
              <p className="text-sm text-zinc-500">No output yet.</p>
            ) : (
              <pre className="whitespace-pre-wrap text-xs text-zinc-700">{output.join("\n")}</pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
