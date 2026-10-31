-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'editor');

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entry" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_name_key" ON "product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_subject_key" ON "app_user"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "membership_user_id_product_id_key" ON "membership"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "audit_entry_target_type_target_id_idx" ON "audit_entry"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_entry_at_idx" ON "audit_entry"("at");

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

