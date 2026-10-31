-- AlterTable
ALTER TABLE "debt_item" ADD COLUMN     "priority_calculated" DOUBLE PRECISION,
ADD COLUMN     "priority_override" DOUBLE PRECISION,
ADD COLUMN     "priority_override_reason" TEXT;

-- generated in a separate statement: it may only reference columns that already exist
ALTER TABLE "debt_item" ADD COLUMN "priority_effective" DOUBLE PRECISION
  GENERATED ALWAYS AS (COALESCE("priority_override", "priority_calculated")) STORED;

-- CreateTable
CREATE TABLE "assessment_model" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "criteria" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment" (
    "id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "priority_calculated" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "assessed_by" TEXT,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_model_version_key" ON "assessment_model"("version");

-- CreateIndex
CREATE INDEX "assessment_debt_id_assessed_at_idx" ON "assessment"("debt_id", "assessed_at");

-- CreateIndex
CREATE INDEX "debt_item_priority_calculated_idx" ON "debt_item"("priority_calculated");

-- CreateIndex
CREATE INDEX "debt_item_priority_override_idx" ON "debt_item"("priority_override");

-- CreateIndex
CREATE INDEX "debt_item_priority_effective_idx" ON "debt_item"("priority_effective");

-- AddForeignKey
ALTER TABLE "assessment_model" ADD CONSTRAINT "assessment_model_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debt_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "assessment_model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- exactly one active scoring model
CREATE UNIQUE INDEX "assessment_model_one_active" ON "assessment_model" ("active") WHERE "active";

-- scores and priorities are 0-100 / 1-5 by contract; the database guards the range too
ALTER TABLE "debt_item" ADD CONSTRAINT "debt_item_priority_range"
  CHECK (("priority_calculated" IS NULL OR "priority_calculated" BETWEEN 0 AND 100)
     AND ("priority_override" IS NULL OR "priority_override" BETWEEN 0 AND 100));
ALTER TABLE "debt_item" ADD CONSTRAINT "debt_item_override_needs_reason"
  CHECK ("priority_override" IS NULL OR length(btrim(coalesce("priority_override_reason", ''))) > 0);
