-- Additive migration only: company official receipt accounts and customer default receipt account reference.

CREATE TABLE "CompanyReceiptAccount" (
  "id" TEXT NOT NULL,
  "accountCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "scenarioName" TEXT,
  "paymentMethod" TEXT,
  "currency" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "accountNo" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "swiftCode" TEXT,
  "bankAddress" TEXT,
  "usageNotes" TEXT,
  "riskNotes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "disabledReason" TEXT,
  "maintainedByUserId" TEXT,
  "maintainedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyReceiptAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Customer"
  ADD COLUMN "defaultReceiptAccountId" TEXT,
  ADD COLUMN "defaultReceiptAccountSelectedAt" TIMESTAMP(3),
  ADD COLUMN "defaultReceiptAccountSelectedByUserId" TEXT,
  ADD COLUMN "defaultReceiptAccountSelectedByName" TEXT,
  ADD COLUMN "defaultReceiptAccountNote" TEXT;

CREATE UNIQUE INDEX "CompanyReceiptAccount_accountCode_key" ON "CompanyReceiptAccount"("accountCode");
CREATE INDEX "CompanyReceiptAccount_currency_idx" ON "CompanyReceiptAccount"("currency");
CREATE INDEX "CompanyReceiptAccount_paymentMethod_idx" ON "CompanyReceiptAccount"("paymentMethod");
CREATE INDEX "CompanyReceiptAccount_isActive_idx" ON "CompanyReceiptAccount"("isActive");
CREATE INDEX "CompanyReceiptAccount_displayName_idx" ON "CompanyReceiptAccount"("displayName");
CREATE INDEX "Customer_defaultReceiptAccountId_idx" ON "Customer"("defaultReceiptAccountId");

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_defaultReceiptAccountId_fkey"
  FOREIGN KEY ("defaultReceiptAccountId") REFERENCES "CompanyReceiptAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
