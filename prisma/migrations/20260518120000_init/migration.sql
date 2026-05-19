CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Provider" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "monthlyQuota" INTEGER NOT NULL DEFAULT 10,
  "usedQuota" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "description" TEXT,
  "serviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadAssignment" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AllocationState" (
  "serviceId" TEXT NOT NULL,
  "lastAssignedIndex" INTEGER NOT NULL DEFAULT -1,
  CONSTRAINT "AllocationState_pkey" PRIMARY KEY ("serviceId")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");
CREATE UNIQUE INDEX "Lead_phone_serviceId_key" ON "Lead"("phone", "serviceId");
CREATE UNIQUE INDEX "LeadAssignment_leadId_providerId_key" ON "LeadAssignment"("leadId", "providerId");
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_name_nonempty_check"
  CHECK (char_length(trim("name")) > 0);

ALTER TABLE "Provider"
  ADD CONSTRAINT "Provider_quota_check"
  CHECK ("monthlyQuota" >= 0 AND "usedQuota" >= 0 AND "usedQuota" <= "monthlyQuota");

ALTER TABLE "Provider"
  ADD CONSTRAINT "Provider_name_nonempty_check"
  CHECK (char_length(trim("name")) > 0);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_required_fields_check"
  CHECK (
    char_length(trim("customerName")) > 0
    AND char_length(trim("city")) > 0
    AND "phone" ~ '^[0-9]{10,15}$'
  );

ALTER TABLE "WebhookEvent"
  ADD CONSTRAINT "WebhookEvent_idempotency_key_check"
  CHECK (char_length(trim("idempotencyKey")) > 0 AND char_length("idempotencyKey") <= 120);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment"
  ADD CONSTRAINT "LeadAssignment_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment"
  ADD CONSTRAINT "LeadAssignment_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AllocationState"
  ADD CONSTRAINT "AllocationState_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
