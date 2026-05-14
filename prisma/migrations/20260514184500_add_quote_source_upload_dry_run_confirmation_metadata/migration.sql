-- Add dry-run confirmation metadata to uploaded quote source files.
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "stagingBatchId" TEXT;
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunConfirmedAt" TIMESTAMP(3);
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunConfirmedByUserId" TEXT;
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunConfirmedByName" TEXT;

CREATE INDEX "QuoteSourceUpload_stagingBatchId_idx" ON "QuoteSourceUpload"("stagingBatchId");
CREATE INDEX "QuoteSourceUpload_dryRunConfirmedAt_idx" ON "QuoteSourceUpload"("dryRunConfirmedAt");
