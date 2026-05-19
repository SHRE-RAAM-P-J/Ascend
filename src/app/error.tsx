"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700">Something went wrong</h2>
        <p className="mt-2 text-sm text-zinc-700">{error.message || "Unexpected application error."}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
