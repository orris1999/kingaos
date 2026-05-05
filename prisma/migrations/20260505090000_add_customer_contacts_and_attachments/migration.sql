-- CreateTable
CREATE TABLE "CustomerContact" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "wechatOrWhatsapp" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAttachment" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "attachmentName" TEXT NOT NULL,
  "attachmentType" TEXT,
  "fileUrl" TEXT,
  "storageProvider" TEXT NOT NULL DEFAULT 'external_url',
  "storageKey" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "description" TEXT,
  "uploadedByUserId" TEXT,
  "uploadedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CustomerAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_isPrimary_idx" ON "CustomerContact"("customerId", "isPrimary");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_sortOrder_idx" ON "CustomerContact"("customerId", "sortOrder");

-- CreateIndex
CREATE INDEX "CustomerAttachment_customerId_idx" ON "CustomerAttachment"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAttachment_attachmentType_idx" ON "CustomerAttachment"("attachmentType");

-- CreateIndex
CREATE INDEX "CustomerAttachment_deletedAt_idx" ON "CustomerAttachment"("deletedAt");

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAttachment" ADD CONSTRAINT "CustomerAttachment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
