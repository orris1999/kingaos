import type { QuoteSourceUpload } from "@prisma/client";
import type { AuthUser } from "./auth";
import { prisma } from "./db";
import {
  assertQuoteSourceUploadObjectKey,
  fileExtension,
  sanitizeOssFileName,
  validateQuoteSourceUploadRequest
} from "./oss";

const SENSITIVE_PRICE_FIELD_NAMES = [
  "amount",
  "unitPrice",
  "costPrice",
  "quotePrice",
  "salesPrice",
  "approvedPrice",
  "financeApprovedPrice",
  "minimumPrice",
  "grossMargin",
  "margin",
  "profit",
  "sentToCustomer",
  "officialQuote"
];

export type CreateQuoteSourceUploadInput = {
  sourceFileName?: string;
  originalFileName: string;
  objectKey: string;
  mimeType?: string;
  fileSize?: number;
  adapterId?: string;
  category?: string;
  notes?: string;
  warnings?: string[];
};

export function assertCanManageQuoteSourceUpload(actor: AuthUser) {
  if (actor.role !== "super_admin") {
    throw new Error("当前账号不能上传财务报价表。");
  }
}

export function assertNoQuoteSourceUploadSensitiveFields(input: Record<string, unknown>) {
  const found = SENSITIVE_PRICE_FIELD_NAMES.find((fieldName) => Object.prototype.hasOwnProperty.call(input, fieldName));
  if (found) {
    throw new Error("quote source upload metadata cannot include sensitive price fields");
  }
}

function optionalText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeWarnings(warnings: unknown) {
  if (!Array.isArray(warnings)) return null;
  const values = warnings.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 50);
  return values.length > 0 ? values : null;
}

export async function listQuoteSourceUploads(limit = 50) {
  return prisma.quoteSourceUpload.findMany({
    orderBy: { uploadedAt: "desc" },
    take: Math.max(1, Math.min(100, Math.floor(limit))),
  });
}

export async function createQuoteSourceUploadMetadata(actor: AuthUser, input: CreateQuoteSourceUploadInput) {
  assertCanManageQuoteSourceUpload(actor);
  assertNoQuoteSourceUploadSensitiveFields(input as Record<string, unknown>);
  const sourceFileName = sanitizeOssFileName(input.sourceFileName || input.originalFileName);
  const originalFileName = String(input.originalFileName || "").trim();
  const storageKey = assertQuoteSourceUploadObjectKey(input.objectKey);
  const validated = validateQuoteSourceUploadRequest({
    fileName: sourceFileName,
    fileSize: Number(input.fileSize || 0),
    mimeType: String(input.mimeType || "")
  });
  const fileExt = validated.fileExt || fileExtension(sourceFileName);

  if (!originalFileName) throw new Error("原始文件名无效。");
  const warnings = normalizeWarnings(input.warnings);

  return prisma.$transaction(async (tx) => {
    const upload = await tx.quoteSourceUpload.create({
      data: {
        sourceFileName,
        originalFileName,
        fileExt,
        mimeType: validated.mimeType,
        fileSize: validated.fileSize,
        storageProvider: "aliyun_oss",
        storageKey,
        uploadStatus: "uploaded",
        adapterId: optionalText(input.adapterId),
        category: optionalText(input.category),
        submittedByRole: "finance",
        consumerDepartment: "export",
        uploadedByUserId: actor.id,
        uploadedByName: actor.name,
        notes: optionalText(input.notes),
        ...(warnings ? { warnings } : {})
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "quote_source_upload.create",
        entityType: "QuoteSourceUpload",
        entityId: upload.id,
        metadata: {
          uploadId: upload.id,
          sourceFileName: upload.sourceFileName,
          storageProvider: upload.storageProvider,
          storageKey: upload.storageKey,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          uploadedByUserId: actor.id
        }
      }
    });
    return upload;
  });
}

export function quoteSourceUploadViewModel(upload: QuoteSourceUpload) {
  const dryRunSummary = upload.dryRunSummary && typeof upload.dryRunSummary === "object" && !Array.isArray(upload.dryRunSummary)
    ? upload.dryRunSummary as Record<string, unknown>
    : null;
  const dryRunWarnings = Array.isArray(upload.dryRunWarnings)
    ? upload.dryRunWarnings.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const nestedSummary = dryRunSummary?.dryRunSummary && typeof dryRunSummary.dryRunSummary === "object" && !Array.isArray(dryRunSummary.dryRunSummary)
    ? dryRunSummary.dryRunSummary as Record<string, unknown>
    : null;
  const mappedColumns = nestedSummary?.mappedColumns && typeof nestedSummary.mappedColumns === "object" && !Array.isArray(nestedSummary.mappedColumns)
    ? nestedSummary.mappedColumns as Record<string, string[]>
    : {};
  const fieldDetection = dryRunSummary?.fieldDetection && typeof dryRunSummary.fieldDetection === "object"
    ? dryRunSummary.fieldDetection as Record<string, boolean>
    : {};

  return {
    id: upload.id,
    sourceFileName: upload.sourceFileName,
    originalFileName: upload.originalFileName,
    fileExt: upload.fileExt,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    uploadStatus: upload.uploadStatus,
    adapterId: upload.adapterId,
    category: upload.category,
    uploadedByName: upload.uploadedByName,
    uploadedAt: upload.uploadedAt.toISOString(),
    dryRunStatus: upload.dryRunStatus,
    dryRunAdapterId: upload.dryRunAdapterId,
    dryRunCategory: upload.dryRunCategory,
    dryRunAt: upload.dryRunAt?.toISOString() ?? null,
    dryRunByName: upload.dryRunByName,
    stagingBatchId: upload.stagingBatchId,
    dryRunConfirmedAt: upload.dryRunConfirmedAt?.toISOString() ?? null,
    dryRunConfirmedByName: upload.dryRunConfirmedByName,
    dryRunSheetCount: typeof dryRunSummary?.sheetCount === "number" ? dryRunSummary.sheetCount : null,
    dryRunMappedColumnKeys: Object.keys(mappedColumns),
    dryRunFieldDetection: {
      hasKjColumn: Boolean(fieldDetection.hasKjColumn),
      hasOemOrOeColumn: Boolean(fieldDetection.hasOemOrOeColumn),
      hasProductNameColumn: Boolean(fieldDetection.hasProductNameColumn),
      hasCostCandidateColumn: Boolean(fieldDetection.hasCostCandidateColumn),
      hasQuoteCandidateColumn: Boolean(fieldDetection.hasQuoteCandidateColumn),
      hasPackagingColumn: Boolean(fieldDetection.hasPackagingColumn)
    },
    dryRunWarnings
  };
}
