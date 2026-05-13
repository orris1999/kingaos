-- Additive migration only: Finance quote source staging metadata.
-- This creates metadata tables for future Finance-owned quote source staging.
-- It does not store concrete price values or formal quote states.

CREATE TABLE "QuoteSourceStagingBatch" (
  "id" TEXT NOT NULL,
  "sourceFileName" TEXT NOT NULL,
  "adapterId" TEXT NOT NULL,
  "category" TEXT,
  "submittedByRole" TEXT NOT NULL DEFAULT 'finance',
  "consumerDepartment" TEXT NOT NULL DEFAULT 'export',
  "dryRunDecisionStatus" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdByUserId" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedByUserId" TEXT,
  "confirmedByName" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "warnings" JSONB,
  "notes" TEXT,

  CONSTRAINT "QuoteSourceStagingBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteSourceStagingRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceRowNumber" INTEGER,
  "rawKjCode" TEXT,
  "standardKjCode" TEXT,
  "baseKjCode" TEXT,
  "oldKjNo" TEXT,
  "fumacrmCode" TEXT,
  "dingjieCodeWithoutCap" TEXT,
  "dingjieCodeWithCap" TEXT,
  "productNameCandidate" TEXT,
  "category" TEXT,
  "modelCandidate" TEXT,
  "specificationCandidate" TEXT,
  "tradeMode" TEXT NOT NULL DEFAULT 'unknown',
  "priceCandidateStatus" TEXT NOT NULL,
  "hasCostCandidate" BOOLEAN NOT NULL DEFAULT false,
  "hasQuoteCandidate" BOOLEAN NOT NULL DEFAULT false,
  "hasPackagingInfo" BOOLEAN NOT NULL DEFAULT false,
  "hasOemInfo" BOOLEAN NOT NULL DEFAULT false,
  "visibility" TEXT NOT NULL,
  "rowStatus" TEXT NOT NULL,
  "warnings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteSourceStagingRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteSourceStagingBatch_adapterId_idx" ON "QuoteSourceStagingBatch"("adapterId");
CREATE INDEX "QuoteSourceStagingBatch_category_idx" ON "QuoteSourceStagingBatch"("category");
CREATE INDEX "QuoteSourceStagingBatch_status_idx" ON "QuoteSourceStagingBatch"("status");
CREATE INDEX "QuoteSourceStagingBatch_dryRunDecisionStatus_idx" ON "QuoteSourceStagingBatch"("dryRunDecisionStatus");
CREATE INDEX "QuoteSourceStagingBatch_createdAt_idx" ON "QuoteSourceStagingBatch"("createdAt");

CREATE INDEX "QuoteSourceStagingRow_batchId_idx" ON "QuoteSourceStagingRow"("batchId");
CREATE INDEX "QuoteSourceStagingRow_standardKjCode_idx" ON "QuoteSourceStagingRow"("standardKjCode");
CREATE INDEX "QuoteSourceStagingRow_baseKjCode_idx" ON "QuoteSourceStagingRow"("baseKjCode");
CREATE INDEX "QuoteSourceStagingRow_oldKjNo_idx" ON "QuoteSourceStagingRow"("oldKjNo");
CREATE INDEX "QuoteSourceStagingRow_fumacrmCode_idx" ON "QuoteSourceStagingRow"("fumacrmCode");
CREATE INDEX "QuoteSourceStagingRow_dingjieCodeWithoutCap_idx" ON "QuoteSourceStagingRow"("dingjieCodeWithoutCap");
CREATE INDEX "QuoteSourceStagingRow_dingjieCodeWithCap_idx" ON "QuoteSourceStagingRow"("dingjieCodeWithCap");
CREATE INDEX "QuoteSourceStagingRow_category_idx" ON "QuoteSourceStagingRow"("category");
CREATE INDEX "QuoteSourceStagingRow_rowStatus_idx" ON "QuoteSourceStagingRow"("rowStatus");
CREATE INDEX "QuoteSourceStagingRow_visibility_idx" ON "QuoteSourceStagingRow"("visibility");

ALTER TABLE "QuoteSourceStagingRow"
  ADD CONSTRAINT "QuoteSourceStagingRow_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "QuoteSourceStagingBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
