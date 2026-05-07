-- Field configuration enhancements for export customer profiles.
-- Additive only: no destructive changes, no data cleanup.

ALTER TABLE "Customer"
ADD COLUMN "customerTypes" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "CustomerAttachment"
ADD COLUMN "fieldKey" TEXT,
ADD COLUMN "fieldLabel" TEXT;

CREATE INDEX "CustomerAttachment_customerId_fieldKey_idx" ON "CustomerAttachment"("customerId", "fieldKey");
