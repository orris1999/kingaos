-- CreateTable
CREATE TABLE "QuoteCandidateAmount" (
    "id" TEXT NOT NULL,
    "stagingBatchId" TEXT NOT NULL,
    "stagingRowId" TEXT NOT NULL,
    "sourceUploadId" TEXT,
    "sourceColumnName" TEXT,
    "sourceColumnDate" TEXT,
    "tradeMode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "candidateValue" DECIMAL(18,4) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'finance_quote_source_staging',
    "status" TEXT NOT NULL DEFAULT 'not_finance_approved',
    "visibility" TEXT NOT NULL DEFAULT 'finance_only',
    "isFinanceApprovedPrice" BOOLEAN NOT NULL DEFAULT false,
    "canBeSentToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "requiresFinancePricing" BOOLEAN NOT NULL DEFAULT true,
    "importedByUserId" TEXT,
    "importedByName" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteCandidateAmount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteCandidateAmount_stagingBatchId_idx" ON "QuoteCandidateAmount"("stagingBatchId");

-- CreateIndex
CREATE INDEX "QuoteCandidateAmount_stagingRowId_idx" ON "QuoteCandidateAmount"("stagingRowId");

-- CreateIndex
CREATE INDEX "QuoteCandidateAmount_sourceUploadId_idx" ON "QuoteCandidateAmount"("sourceUploadId");

-- CreateIndex
CREATE INDEX "QuoteCandidateAmount_tradeMode_idx" ON "QuoteCandidateAmount"("tradeMode");

-- CreateIndex
CREATE INDEX "QuoteCandidateAmount_currency_idx" ON "QuoteCandidateAmount"("currency");

-- CreateIndex
CREATE INDEX "QuoteCandidateAmount_status_idx" ON "QuoteCandidateAmount"("status");

-- CreateIndex
CREATE INDEX "QuoteCandidateAmount_visibility_idx" ON "QuoteCandidateAmount"("visibility");
