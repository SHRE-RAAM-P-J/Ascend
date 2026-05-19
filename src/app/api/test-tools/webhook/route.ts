import { NextResponse } from "next/server";
import { processQuotaResetWebhook } from "@/lib/testTools";

type WebhookPayload = {
  idempotencyKey?: string;
  times?: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: WebhookPayload;
    try {
      body = (await request.json()) as WebhookPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const requestedTimes = Number(body.times ?? 1);
    const times = Number.isFinite(requestedTimes)
      ? Math.max(1, Math.min(Math.floor(requestedTimes), 50))
      : 1;
    const idempotencyKey = body.idempotencyKey?.trim() || crypto.randomUUID();

    if (idempotencyKey.length > 120) {
      return NextResponse.json(
        { error: "Idempotency key must be 120 characters or less." },
        { status: 400 },
      );
    }

    const results = await Promise.all(
      Array.from({ length: times }, () => processQuotaResetWebhook(idempotencyKey)),
    );

    const processed = results.filter((result) => result.status === "processed").length;
    const duplicates = results.filter((result) => result.status === "duplicate").length;

    return NextResponse.json({
      message: "Webhook trigger completed.",
      idempotencyKey,
      attempts: times,
      processed,
      duplicates,
      logs: results.flatMap((result, index) => [
        `Attempt ${index + 1}: ${result.status}`,
        ...result.logs,
      ]),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
