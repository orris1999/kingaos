-- Additive migration only: customer field change history for export customer profiles.

CREATE TABLE "CustomerFieldChangeHistory" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "fieldLabel" TEXT NOT NULL,
  "fieldGroup" TEXT,
  "fieldKind" TEXT NOT NULL DEFAULT 'system',
  "fieldType" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "oldDisplayValue" TEXT,
  "newDisplayValue" TEXT,
  "changeType" TEXT NOT NULL DEFAULT 'update',
  "source" TEXT NOT NULL DEFAULT 'customer_edit',
  "changedByUserId" TEXT,
  "changedByName" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerFieldChangeHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerFieldChangeHistory_customerId_idx" ON "CustomerFieldChangeHistory"("customerId");
CREATE INDEX "CustomerFieldChangeHistory_fieldKey_idx" ON "CustomerFieldChangeHistory"("fieldKey");
CREATE INDEX "CustomerFieldChangeHistory_changedAt_idx" ON "CustomerFieldChangeHistory"("changedAt");
CREATE INDEX "CustomerFieldChangeHistory_changedByUserId_idx" ON "CustomerFieldChangeHistory"("changedByUserId");

ALTER TABLE "CustomerFieldChangeHistory"
  ADD CONSTRAINT "CustomerFieldChangeHistory_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
