import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { name: "asc" },
      include: {
        assignments: {
          orderBy: { assignedAt: "desc" },
          include: {
            lead: {
              include: {
                service: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    const data = providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      usedQuota: provider.usedQuota,
      remainingQuota: Math.max(provider.monthlyQuota - provider.usedQuota, 0),
      assignedLeadsCount: provider.assignments.length,
      assignedLeads: provider.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        assignedAt: assignment.assignedAt,
        leadId: assignment.lead.id,
        customerName: assignment.lead.customerName,
        phone: assignment.lead.phone,
        city: assignment.lead.city,
        serviceName: assignment.lead.service.name,
      })),
    }));

    return NextResponse.json({ providers: data });
  } catch {
    return NextResponse.json(
      { error: "Failed to load providers dashboard data." },
      { status: 500 },
    );
  }
}
