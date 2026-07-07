-- CreateTable
CREATE TABLE "income_entries" (
    "uuid" TEXT NOT NULL,
    "external_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'moy-nalog',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "description" TEXT,
    "income_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "receipt_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_entries_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "income_entries_income_date_idx" ON "income_entries"("income_date");

-- CreateIndex
CREATE INDEX "income_entries_status_idx" ON "income_entries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "income_entries_source_external_id_key" ON "income_entries"("source", "external_id");
