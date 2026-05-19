import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const services = ["Service 1", "Service 2", "Service 3"];
const providers = Array.from({ length: 8 }, (_, index) => ({
  name: `Provider ${index + 1}`,
  monthlyQuota: 10,
  usedQuota: 0,
}));

async function main() {
  for (const name of services) {
    const service = await prisma.service.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    await prisma.allocationState.upsert({
      where: { serviceId: service.id },
      update: { lastAssignedIndex: -1 },
      create: {
        serviceId: service.id,
        lastAssignedIndex: -1,
      },
    });
  }

  for (const provider of providers) {
    await prisma.provider.upsert({
      where: { name: provider.name },
      update: {
        monthlyQuota: provider.monthlyQuota,
        usedQuota: provider.usedQuota,
      },
      create: provider,
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
