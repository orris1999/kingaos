-- Customer identity and duplicate review baseline.
-- Additive only: creates new tables, columns, and indexes without deleting customer data.

CREATE TABLE "CustomerIdentity" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'export_customer',
  "displayName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerDuplicateReviewRequest" (
  "id" TEXT NOT NULL,
  "department" TEXT NOT NULL DEFAULT 'export',
  "moduleKey" TEXT NOT NULL DEFAULT 'export_customer',
  "requestedByUserId" TEXT NOT NULL,
  "requestedByName" TEXT,
  "proposedCustomerName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "existingIdentityId" TEXT,
  "existingCustomerIds" JSONB,
  "requestedPayload" JSONB,
  "requestReason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decidedByUserId" TEXT,
  "decidedByName" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdCustomerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerDuplicateReviewRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Customer" ADD COLUMN "customerIdentityId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "normalizedCustomerName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "duplicateApprovalStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Customer" ADD COLUMN "duplicateApprovalRequestId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "duplicateApprovedByUserId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "duplicateApprovedByName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "duplicateApprovedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "duplicateApprovalReason" TEXT;

CREATE UNIQUE INDEX "CustomerIdentity_scope_normalizedName_key" ON "CustomerIdentity"("scope", "normalizedName");
CREATE INDEX "CustomerIdentity_normalizedName_idx" ON "CustomerIdentity"("normalizedName");

CREATE INDEX "CustomerDuplicateReviewRequest_department_idx" ON "CustomerDuplicateReviewRequest"("department");
CREATE INDEX "CustomerDuplicateReviewRequest_normalizedName_idx" ON "CustomerDuplicateReviewRequest"("normalizedName");
CREATE INDEX "CustomerDuplicateReviewRequest_status_idx" ON "CustomerDuplicateReviewRequest"("status");
CREATE INDEX "CustomerDuplicateReviewRequest_requestedByUserId_idx" ON "CustomerDuplicateReviewRequest"("requestedByUserId");

CREATE INDEX "Customer_customerIdentityId_idx" ON "Customer"("customerIdentityId");
CREATE INDEX "Customer_normalizedCustomerName_idx" ON "Customer"("normalizedCustomerName");
CREATE INDEX "Customer_duplicateApprovalStatus_idx" ON "Customer"("duplicateApprovalStatus");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_customerIdentityId_fkey" FOREIGN KEY ("customerIdentityId") REFERENCES "CustomerIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
