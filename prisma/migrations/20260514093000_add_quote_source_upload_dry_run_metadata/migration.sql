-- Additive metadata-only dry-run fields for Finance quote source upload pilot.
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunStatus" TEXT NOT NULL DEFAULT 'not_run';
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunAdapterId" TEXT;
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunCategory" TEXT;
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunSummary" JSONB;
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunWarnings" JSONB;
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunAt" TIMESTAMP(3);
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunByUserId" TEXT;
ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunByName" TEXT;

CREATE INDEX "QuoteSourceUpload_dryRunStatus_idx" ON "QuoteSourceUpload"("dryRunStatus");
CREATE INDEX "QuoteSourceUpload_dryRunAt_idx" ON "QuoteSourceUpload"("dryRunAt");
