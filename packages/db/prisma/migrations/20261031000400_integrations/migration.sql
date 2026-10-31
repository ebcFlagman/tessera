-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('sonarcloud', 'gitlab');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ok', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "integration" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "credentials_encrypted" TEXT NOT NULL,
    "schedule_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ok',
    "last_attempt_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "state" "SyncState" NOT NULL DEFAULT 'queued',
    "trigger" TEXT NOT NULL,
    "requested_by" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "counts" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "url" TEXT,
    "raw" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gone_at" TIMESTAMP(3),

    CONSTRAINT "finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_product_id_idx" ON "integration"("product_id");

-- CreateIndex
CREATE INDEX "sync_run_integration_id_created_at_idx" ON "sync_run"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "finding_debt_id_idx" ON "finding"("debt_id");

-- CreateIndex
CREATE UNIQUE INDEX "finding_integration_id_external_id_key" ON "finding"("integration_id", "external_id");

-- AddForeignKey
ALTER TABLE "integration" ADD CONSTRAINT "integration_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debt_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- at most one unfinished run per integration: a second import request reuses it
CREATE UNIQUE INDEX "sync_run_one_active" ON "sync_run" ("integration_id") WHERE "state" IN ('queued', 'running');

ALTER TABLE "integration" ADD CONSTRAINT "integration_schedule_range"
  CHECK ("schedule_minutes" BETWEEN 5 AND 10080);
