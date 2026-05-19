# Mini Lead Allocation

Next.js App Router application for lead intake, provider allocation, provider dashboards, and admin test tools.

## Stack
- Next.js App Router
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Vercel-compatible route handlers

## Setup
1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Fill required database values:
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
```

4. Apply migrations and seed baseline services/providers:
```bash
npm run prisma:migrate:deploy
npm run db:seed
```

5. Start locally:
```bash
npm run dev
```

## Environment Variables
- `DATABASE_URL`: required by the app runtime and Prisma client.
- `DIRECT_URL`: required by Prisma migrations. On hosted Postgres providers, this should be the direct non-pooled URL when available.

Runtime validation lives in [src/lib/env.ts](src/lib/env.ts). The app requires `DATABASE_URL` at runtime; migrations require both values.

## App Pages
- `/request-service`: customer lead form.
- `/dashboard`: provider dashboard with polling every 3 seconds.
- `/test-tools`: admin/testing page for webhook reset and concurrent lead generation.

## Allocation Rules
Allocation logic lives in [src/services/leadAllocation.ts](src/services/leadAllocation.ts).

Supported assignment rules:
- Service 1: mandatory Provider 1, pool Providers 2, 3, 4.
- Service 2: mandatory Provider 5, pool Providers 6, 7, 8.
- Service 3: mandatory Providers 1 and 4, pool Providers 2, 3, 5, 6, 7, 8.

Each lead receives exactly 3 unique providers. Mandatory providers are included when quota is available, and pool providers are chosen through persisted round-robin state in `AllocationState`.

## Concurrency
- Lead allocation runs inside a Prisma transaction.
- The service allocation row is locked with `FOR UPDATE`.
- Candidate provider rows are locked with `FOR UPDATE` before quota checks.
- Provider quota increments use an atomic `UPDATE ... WHERE usedQuota < monthlyQuota RETURNING id`.
- Duplicate leads are blocked by the database unique index on `phone + serviceId`.
- Duplicate provider assignment for the same lead is blocked by the database unique index on `leadId + providerId`.

## Validation
- API validation normalizes phone numbers to digits.
- Database migration adds checks for lead phone format and required lead fields.
- Provider quota constraints prevent `usedQuota` from exceeding `monthlyQuota`.
- User-facing API errors are returned for invalid input, duplicate leads, missing services, and allocation failures.

## Webhook Idempotency
Webhook logic lives in [src/lib/testTools.ts](src/lib/testTools.ts).

- Quota reset is performed through the webhook processor.
- `WebhookEvent.idempotencyKey` has a database unique constraint.
- The processor uses `INSERT ... ON CONFLICT DO NOTHING`.
- Repeated calls with the same key return `duplicate` and do not repeat reset logic.

## Test Tools
The `/test-tools` page supports:
- Reset quotas through the webhook path.
- Trigger webhook multiple times with the same idempotency key.
- Generate 10 leads simultaneously.
- Display logs/output for each action.

## Deployment on Vercel
1. Push the repo to GitHub.
2. Import it in Vercel.
3. Add `DATABASE_URL` and `DIRECT_URL` in Vercel project environment variables.
4. Deploy.
5. Run migrations against production:
```bash
npm run prisma:migrate:deploy
```
6. Seed baseline services/providers once:
```bash
npm run db:seed
```

`postinstall` runs `prisma generate`, so Vercel builds have a generated Prisma client.

## Important Production Notes
- Use a real PostgreSQL database; there is no in-memory or JSON storage.
- If deploying against an existing database that already has tables but no Prisma migration history, baseline the migration before running `migrate deploy`.
- Keep `/test-tools` protected or disabled for a public production deployment because it intentionally mutates data.