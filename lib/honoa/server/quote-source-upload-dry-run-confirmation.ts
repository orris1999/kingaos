import type { QuoteSourceUpload } from "@prisma/client";
import type { AuthUser } from "./auth";
import { prisma } from "./db";
import { decideQuoteSourceDryRunNextStep } from "../quote-draft/source-dry-run-decision";
import type { QuoteSourceDryRunDecisionInput } from "../quote-draft/source-dry-run-decision";
import { mapDryRunDecisionStatusToStagingBatchStatus } from "../quote-draft/source-staging-mapper";

type ConfirmQuoteSourceUploadDryRunOptions = {
  db?: typeof prisma;
  now?: () => Date;
};

const PRICE_BOUNDARY_WARNING = "dry-run 确认只创建 staging batch metadata，不导入价格，不生成 staging rows。";
const FINANCE_APPROVAL_WARNING = "dry-run completed 不等于财务批准价格，staging batch 仍不是正式价格表。";

const FORBIDDEN_CONFIRMATION_METADATA_KEYS = [
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
  "officialQuote",
  "excelRows",
  "kjRows",
  "oemRows",
  "signedUrl",
  "accessKey"
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function assertNoForbiddenConfirmationMetadataKeys(value: unknown) {
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      const normalized = key.toLowerCase();
      const forbidden = FORBIDDEN_CONFIRMATION_METADATA_KEYS.find((field) => normalized.includes(field.toLowerCase()));
      if (forbidden) {
        throw new Error(`dry-run confirmation metadata cannot include forbidden field key: ${forbidden}`);
      }
      stack.push(nested);
    }
  }
}

export function assertCanConfirmQuoteSourceUploadDryRun(actor: AuthUser) {
  if (actor.role !== "super_admin") {
    throw new Error("当前账号不能确认财务报价表 dry-run 结果。");
  }
}

function getDryRunDecisionInput(upload: Pick<
  QuoteSourceUpload,
  "dryRunAdapterId" | "dryRunCategory" | "dryRunSummary" | "dryRunWarnings"
>): QuoteSourceDryRunDecisionInput {
  const dryRunSummary = asRecord(upload.dryRunSummary);
  const adapterMatch = asRecord(dryRunSummary?.adapterMatch);
  const nestedSummary = asRecord(dryRunSummary?.dryRunSummary);
  const fieldDetection = asRecord(dryRunSummary?.fieldDetection);

  return {
    adapterId: upload.dryRunAdapterId ?? String(adapterMatch?.adapterId || nestedSummary?.adapterId || ""),
    category: upload.dryRunCategory ?? String(adapterMatch?.category || ""),
    confidence: adapterMatch?.confidence === "high" || adapterMatch?.confidence === "medium" || adapterMatch?.confidence === "low"
      ? adapterMatch.confidence
      : "none",
    hasKjColumn: Boolean(fieldDetection?.hasKjColumn),
    hasOemColumn: Boolean(fieldDetection?.hasOemOrOeColumn),
    hasProductNameColumn: Boolean(fieldDetection?.hasProductNameColumn),
    hasCostCandidateColumn: Boolean(fieldDetection?.hasCostCandidateColumn),
    hasQuoteCandidateColumn: Boolean(fieldDetection?.hasQuoteCandidateColumn),
    hasPackagingColumn: Boolean(fieldDetection?.hasPackagingColumn),
    warnings: unique([
      ...asStringArray(upload.dryRunWarnings),
      ...asStringArray(nestedSummary?.warnings),
      ...asStringArray(adapterMatch?.warnings)
    ]),
    unsupportedReasons: unique([
      ...asStringArray(nestedSummary?.unsupportedReasons),
      ...asStringArray(adapterMatch?.unsupportedReasons)
    ])
  };
}

function getConfirmationWarnings(upload: Pick<QuoteSourceUpload, "dryRunSummary" | "dryRunWarnings">) {
  const dryRunSummary = asRecord(upload.dryRunSummary);
  const nestedSummary = asRecord(dryRunSummary?.dryRunSummary);
  const adapterMatch = asRecord(dryRunSummary?.adapterMatch);
  return unique([
    ...asStringArray(upload.dryRunWarnings),
    ...asStringArray(nestedSummary?.warnings),
    ...asStringArray(nestedSummary?.unsupportedReasons),
    ...asStringArray(adapterMatch?.warnings),
    ...asStringArray(adapterMatch?.unsupportedReasons),
    PRICE_BOUNDARY_WARNING,
    FINANCE_APPROVAL_WARNING
  ]).slice(0, 80);
}

function assertConfirmableUpload(upload: QuoteSourceUpload) {
  if (upload.uploadStatus !== "uploaded") {
    throw new Error("只有 uploaded 状态的报价表文件可以确认 dry-run。");
  }
  if (upload.dryRunStatus !== "completed") {
    throw new Error("只有 completed 状态的 dry-run 结果可以确认。");
  }
  if (!upload.dryRunAdapterId) {
    throw new Error("dry-run 结果缺少 adapterId，不能确认。");
  }
  if (!upload.dryRunCategory) {
    throw new Error("dry-run 结果缺少 category，不能确认。");
  }
  if (!upload.dryRunSummary) {
    throw new Error("dry-run 结果缺少结构摘要，不能确认。");
  }
  if (upload.stagingBatchId) {
    throw new Error("该报价表 dry-run 结果已经确认进入 staging batch。");
  }
}

export async function confirmQuoteSourceUploadDryRun(
  actor: AuthUser,
  uploadId: string,
  options: ConfirmQuoteSourceUploadDryRunOptions = {}
) {
  assertCanConfirmQuoteSourceUploadDryRun(actor);
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  const upload = await db.quoteSourceUpload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error("报价表上传记录不存在。");
  assertConfirmableUpload(upload);

  const decision = decideQuoteSourceDryRunNextStep(getDryRunDecisionInput(upload));
  const status = mapDryRunDecisionStatusToStagingBatchStatus(decision.status);
  const warnings = unique([...getConfirmationWarnings(upload), ...decision.reasons]).slice(0, 100);
  const confirmedAt = now();

  assertNoForbiddenConfirmationMetadataKeys({
    uploadId: upload.id,
    sourceFileName: upload.sourceFileName,
    adapterId: upload.dryRunAdapterId,
    category: upload.dryRunCategory,
    dryRunStatus: upload.dryRunStatus,
    dryRunDecisionStatus: decision.status,
    status,
    warnings
  });

  return db.$transaction(async (tx) => {
    const current = await tx.quoteSourceUpload.findUnique({ where: { id: upload.id } });
    if (!current) throw new Error("报价表上传记录不存在。");
    assertConfirmableUpload(current);

    const batch = await tx.quoteSourceStagingBatch.create({
      data: {
        sourceFileName: current.sourceFileName,
        adapterId: current.dryRunAdapterId!,
        category: current.dryRunCategory,
        submittedByRole: "finance",
        consumerDepartment: "export",
        dryRunDecisionStatus: decision.status,
        status,
        createdByUserId: actor.id,
        createdByName: actor.name,
        warnings,
        notes: "QuoteSourceUpload dry-run confirmed to staging batch metadata only. No rows or prices imported."
      }
    });

    const updatedCount = await tx.quoteSourceUpload.updateMany({
      where: {
        id: current.id,
        stagingBatchId: null
      },
      data: {
        stagingBatchId: batch.id,
        dryRunConfirmedAt: confirmedAt,
        dryRunConfirmedByUserId: actor.id,
        dryRunConfirmedByName: actor.name
      }
    });
    if (updatedCount.count !== 1) {
      throw new Error("该报价表 dry-run 结果已经确认进入 staging batch。");
    }

    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "quote_source_upload.dry_run_confirm",
        entityType: "QuoteSourceUpload",
        entityId: current.id,
        metadata: {
          uploadId: current.id,
          stagingBatchId: batch.id,
          sourceFileName: current.sourceFileName,
          adapterId: current.dryRunAdapterId,
          category: current.dryRunCategory,
          dryRunStatus: current.dryRunStatus,
          dryRunDecisionStatus: decision.status,
          stagingBatchStatus: status,
          actorUserId: actor.id,
          actorName: actor.name,
          warnings
        }
      }
    });

    const confirmedUpload = await tx.quoteSourceUpload.findUnique({ where: { id: current.id } });
    if (!confirmedUpload) throw new Error("报价表上传记录不存在。");

    return {
      upload: confirmedUpload,
      stagingBatch: batch,
      decision
    };
  });
}
