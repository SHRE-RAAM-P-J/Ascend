import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Mini Lead Allocation</h1>
        <p className="mt-2 text-sm text-zinc-600">Choose a page to continue.</p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/request-service" className="rounded-md border border-zinc-300 px-4 py-2 text-sm">
            Request Service
          </Link>
          <Link href="/dashboard" className="rounded-md border border-zinc-300 px-4 py-2 text-sm">
            Provider Dashboard
          </Link>
          <Link href="/test-tools" className="rounded-md border border-zinc-300 px-4 py-2 text-sm sm:col-span-2">
            Test Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
