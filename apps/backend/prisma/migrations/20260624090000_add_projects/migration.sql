-- CreateTable
CREATE TABLE "projects" (
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("uuid")
);

-- Seed the default project (renameable, but never deletable). Existing services migrate here.
INSERT INTO "projects" ("uuid", "name", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Основной', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: add the FK column nullable, backfill existing services, then enforce NOT NULL.
ALTER TABLE "services" ADD COLUMN "project_uuid" TEXT;
UPDATE "services" SET "project_uuid" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "services" ALTER COLUMN "project_uuid" SET NOT NULL;

-- CreateIndex
CREATE INDEX "services_project_uuid_idx" ON "services"("project_uuid");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_project_uuid_fkey" FOREIGN KEY ("project_uuid") REFERENCES "projects"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
