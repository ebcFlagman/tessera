-- CreateTable
CREATE TABLE "metric_snapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "product_id" TEXT NOT NULL,
    "team_id" TEXT,
    "total" INTEGER NOT NULL,
    "open_count" INTEGER NOT NULL,
    "open_effort" DOUBLE PRECISION NOT NULL,
    "open_interest" DOUBLE PRECISION NOT NULL,
    "unestimated_open" INTEGER NOT NULL,
    "count_by_status" JSONB NOT NULL,
    "count_by_kind" JSONB NOT NULL,
    "count_by_priority_band" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_snapshot_date_idx" ON "metric_snapshot"("date");

-- CreateIndex
CREATE INDEX "metric_snapshot_product_id_date_idx" ON "metric_snapshot"("product_id", "date");

-- AddForeignKey
ALTER TABLE "metric_snapshot" ADD CONSTRAINT "metric_snapshot_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- one row per day and (product, team) partition; "no team" is its own partition
CREATE UNIQUE INDEX "metric_snapshot_partition" ON "metric_snapshot" ("date", "product_id", COALESCE("team_id", ''));
