import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateLeadInput, type LeadInput } from "@/lib/leadValidation";
import { allocateLead } from "@/services/leadAllocation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: LeadInput;
    try {
      body = (await request.json()) as LeadInput;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const validated = validateLeadInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const existingLead = await prisma.lead.findUnique({
      where: {
        phone_serviceId: {
          phone: validated.data.phone,
          serviceId: validated.data.serviceId,
        },
      },
      select: { id: true },
    });

    if (existingLead) {
      return NextResponse.json(
        { error: "You already requested this service with the same phone number." },
        { status: 409 },
      );
    }

    const result = await allocateLead(validated.data);

    return NextResponse.json(
      {
        message: "Lead created and provider allocation completed.",
        leadId: result.lead.id,
        assignedProviders: result.assignedProviders,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "You already requested this service with the same phone number." },
        { status: 409 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Something went wrong while creating the lead.";
    const status = message.includes("not found") || message.includes("No allocation rules") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
