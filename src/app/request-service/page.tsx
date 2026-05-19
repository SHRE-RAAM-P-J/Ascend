import prisma from "@/lib/prisma";
import RequestServiceForm from "./RequestServiceForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RequestServicePage() {
  const services = await prisma.service.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-zinc-900">Request Service</h1>
        <p className="mt-1 text-sm text-zinc-600">Fill the form and submit your service request.</p>
        <div className="mt-6">
          <RequestServiceForm services={services} />
        </div>
      </div>
    </div>
  );
}
