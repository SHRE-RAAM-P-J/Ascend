import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { allocateLead } from "@/services/leadAllocation";

type WebhookProcessResult = {
  status: "processed" | "duplicate";
  idempotencyKey: string;
  logs: string[];
};

export async function processQuotaResetWebhook(idempotencyKey: string): Promise<WebhookProcessResult> {
  return prisma.$transaction(async (tx) => {
    const insertResult = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "WebhookEvent" ("id", "idempotencyKey", "action")
      VALUES (${crypto.randomUUID()}, ${idempotencyKey}, 'RESET_PROVIDER_QUOTAS')
      ON CONFLICT ("idempotencyKey") DO NOTHING
      RETURNING "id"
    `;

    if (insertResult.length === 0) {
      return {
        status: "duplicate",
        idempotencyKey,
        logs: [`Duplicate webhook ignored for key ${idempotencyKey}.`],
      };
    }

    const resetResult = await tx.provider.updateMany({
      data: {
        monthlyQuota: 10,
        usedQuota: 0,
      },
    });

    return {
      status: "processed",
      idempotencyKey,
      logs: [
        `Webhook key ${idempotencyKey} processed.`,
        `Reset quotas for ${resetResult.count} provider(s).`,
      ],
    };
  });
}

export async function generateLeadsSimultaneously(count = 10) {
  const services = await prisma.service.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (services.length === 0) {
    throw new Error("No services found. Add services before generating leads.");
  }

  const batchId = Date.now().toString().slice(-10);
  const jobs = Array.from({ length: count }, (_, index) => {
    const service = services[index % services.length];
    const phone = `9${batchId}${index.toString().padStart(4, "0")}`;

    return allocateLead({
      customerName: `Test Lead ${index + 1}`,
      phone,
      city: "Test City",
      description: "Generated from test tools",
      serviceId: service.id,
    });
  });

  const results = await Promise.allSettled(jobs);

  let successCount = 0;
  const logs: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successCount += 1;
      logs.push(`Lead ${index + 1}: success`);
    } else {
      const error =
        result.reason instanceof Error ? result.reason.message : "Unknown error";
      logs.push(`Lead ${index + 1}: failed - ${error}`);
    }
  });

  return {
    requested: count,
    succeeded: successCount,
    failed: count - successCount,
    logs,
  };
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
