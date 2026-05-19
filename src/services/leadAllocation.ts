import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const SERVICE_RULES: Record<
  string,
  { mandatory: string[]; pool: string[]; poolCount: number }
> = {
  "Service 1": {
    mandatory: ["Provider 1"],
    pool: ["Provider 2", "Provider 3", "Provider 4"],
    poolCount: 2,
  },
  "Service 2": {
    mandatory: ["Provider 5"],
    pool: ["Provider 6", "Provider 7", "Provider 8"],
    poolCount: 2,
  },
  "Service 3": {
    mandatory: ["Provider 1", "Provider 4"],
    pool: ["Provider 2", "Provider 3", "Provider 5", "Provider 6", "Provider 7", "Provider 8"],
    poolCount: 1,
  },
  Plumbing: {
    mandatory: ["Provider 1"],
    pool: ["Provider 2", "Provider 3", "Provider 4"],
    poolCount: 2,
  },
  Electrical: {
    mandatory: ["Provider 5"],
    pool: ["Provider 6", "Provider 7", "Provider 8"],
    poolCount: 2,
  },
  HVAC: {
    mandatory: ["Provider 1", "Provider 4"],
    pool: ["Provider 2", "Provider 3", "Provider 5", "Provider 6", "Provider 7", "Provider 8"],
    poolCount: 1,
  },
};

export async function allocateLead(data: {
  customerName: string;
  phone: string;
  city: string;
  description?: string;
  serviceId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: data.serviceId },
    });

    if (!service) {
      throw new Error("Service not found");
    }

    const rule = SERVICE_RULES[service.name];
    if (!rule) {
      throw new Error(`No allocation rules defined for service: ${service.name}`);
    }

    await tx.$queryRaw`SELECT * FROM "AllocationState" WHERE "serviceId" = ${service.id} FOR UPDATE`;

    const state = await tx.allocationState.findUnique({
      where: { serviceId: service.id },
    });

    if (!state) {
      throw new Error("Allocation state not found for service");
    }

    const allRequiredProviderNames = [...new Set([...rule.mandatory, ...rule.pool])].sort();
    await tx.$queryRaw`
      SELECT "id" FROM "Provider"
      WHERE "name" IN (${Prisma.join(allRequiredProviderNames)})
      ORDER BY "name"
      FOR UPDATE
    `;

    const providers = await tx.provider.findMany({
      where: { name: { in: allRequiredProviderNames } },
    });

    const selectedProviders: typeof providers = [];
    for (const mandatoryName of rule.mandatory) {
      const provider = providers.find((p) => p.name === mandatoryName);
      if (!provider) {
        throw new Error(`Mandatory provider ${mandatoryName} not found`);
      }
      if (provider.usedQuota >= provider.monthlyQuota) {
        throw new Error(`Mandatory provider ${mandatoryName} has reached monthly quota`);
      }
      selectedProviders.push(provider);
    }

    let currentIndex = state.lastAssignedIndex;
    const poolSelection: typeof providers = [];
    let attempts = 0;

    while (poolSelection.length < rule.poolCount && attempts < rule.pool.length) {
      currentIndex = (currentIndex + 1) % rule.pool.length;
      const candidateName = rule.pool[currentIndex];
      const candidateProvider = providers.find((p) => p.name === candidateName);

      if (candidateProvider && candidateProvider.usedQuota < candidateProvider.monthlyQuota) {
        poolSelection.push(candidateProvider);
      }
      attempts++;
    }

    if (poolSelection.length < rule.poolCount) {
      throw new Error("Not enough providers with available quota for this service");
    }

    selectedProviders.push(...poolSelection);
    const providerIds = [...new Set(selectedProviders.map((provider) => provider.id))];

    if (providerIds.length !== 3) {
      throw new Error("Allocation must select exactly 3 unique providers");
    }

    const lead = await tx.lead.create({
      data: {
        customerName: data.customerName,
        phone: data.phone,
        city: data.city,
        description: data.description,
        serviceId: service.id,
      },
    });

    const updatedProviders = await tx.$queryRaw<{ id: string }[]>`
      UPDATE "Provider"
      SET "usedQuota" = "usedQuota" + 1
      WHERE "id" IN (${Prisma.join(providerIds)})
      AND "usedQuota" < "monthlyQuota"
      RETURNING "id"
    `;

    if (updatedProviders.length !== providerIds.length) {
      throw new Error("One or more selected providers no longer has available quota");
    }

    await tx.leadAssignment.createMany({
      data: selectedProviders.map((provider) => ({
        leadId: lead.id,
        providerId: provider.id,
      })),
    });

    await tx.allocationState.update({
      where: { serviceId: service.id },
      data: { lastAssignedIndex: currentIndex },
    });

    return {
      lead,
      assignedProviders: selectedProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
      })),
    };
  });
}
