import { NextResponse } from "next/server";
import { generateLeadsSimultaneously } from "@/lib/testTools";

type GeneratePayload = {
  count?: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: GeneratePayload;
    try {
      body = (await request.json()) as GeneratePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const requestedCount = Number(body.count ?? 10);
    const count = Number.isFinite(requestedCount)
      ? Math.max(1, Math.min(Math.floor(requestedCount), 50))
      : 10;
    const result = await generateLeadsSimultaneously(count);

    return NextResponse.json({
      message: "Lead generation completed.",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate leads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
