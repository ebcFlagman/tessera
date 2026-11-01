-- CreateEnum
CREATE TYPE "DebtKind" AS ENUM ('architectural', 'technical');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('open', 'planned', 'in_progress', 'repaid', 'accepted');

-- CreateTable
CREATE TABLE "debt_item" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "kind" "DebtKind" NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'open',
    "owner_id" TEXT,
    "team_id" TEXT,
    "effort_estimate" DOUBLE PRECISION,
    "interest_estimate" DOUBLE PRECISION,
    "accepted_reason" TEXT,
    "review_date" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "field_origin" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_event" (
    "id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debt_item_product_id_status_idx" ON "debt_item"("product_id", "status");

-- CreateIndex
CREATE INDEX "debt_item_kind_idx" ON "debt_item"("kind");

-- CreateIndex
CREATE INDEX "debt_item_owner_id_idx" ON "debt_item"("owner_id");

-- CreateIndex
CREATE INDEX "debt_event_debt_id_at_idx" ON "debt_event"("debt_id", "at");

-- AddForeignKey
ALTER TABLE "debt_item" ADD CONSTRAINT "debt_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_item" ADD CONSTRAINT "debt_item_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_item" ADD CONSTRAINT "debt_item_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_event" ADD CONSTRAINT "debt_event_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debt_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

