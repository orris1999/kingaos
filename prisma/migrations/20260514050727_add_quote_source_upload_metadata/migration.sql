-- CreateTable
CREATE TABLE "QuoteSourceUpload" (
    "id" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileExt" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 'aliyun_oss',
    "storageKey" TEXT NOT NULL,
    "uploadStatus" TEXT NOT NULL DEFAULT 'uploaded',
    "adapterId" TEXT,
    "category" TEXT,
    "submittedByRole" TEXT NOT NULL DEFAULT 'finance',
    "consumerDepartment" TEXT NOT NULL DEFAULT 'export',
    "uploadedByUserId" TEXT,
    "uploadedByName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteSourceUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteSourceUpload_adapterId_idx" ON "QuoteSourceUpload"("adapterId");

-- CreateIndex
CREATE INDEX "QuoteSourceUpload_category_idx" ON "QuoteSourceUpload"("category");

-- CreateIndex
CREATE INDEX "QuoteSourceUpload_uploadStatus_idx" ON "QuoteSourceUpload"("uploadStatus");

-- CreateIndex
CREATE INDEX "QuoteSourceUpload_uploadedAt_idx" ON "QuoteSourceUpload"("uploadedAt");
