import type { PrismaClient } from "@prisma/client";
import type { QuoteSourceStagingRepositoryOptions } from "./source-staging-repository-types";
import { assertNonProductionDatabaseUrl } from "./source-staging-repository";
import { assertQuoteSourceStagingBatchTransition } from "./source-staging-status";
import type {
  QuoteSourceStagingBatchStatus,
  QuoteSourceStagingPriceCandidateStatus,
  QuoteSourceStagingRowStatus,
  QuoteSourceStagingVisibility
} from "./source-staging-types";

type QuoteSourceStagingConfirmationPrisma = Pick<
  PrismaClient,
  "$transaction" | "quoteSourceStagingBatch" | "quoteSourceStagingRow"
>;

type StoredConfirmationRow = {
  id: string;
  rowStatus: string;
  visibility: string;
  priceCandidateStatus: string;
};

export type ConfirmQuoteSourceStagingBatchInput = {
  batchId: string;
  actorUserId: string;
  actorName?: string;
  confirmationNote?: string;
  rowVisibilityPolicy?: "strict_candidate_only" | "include_manual_review";
};

export type QuoteSourceStagingFinanceConfirmedAuditMetadata = {
  batchId: string;
  sourceFileName?: string;
  adapterId?: string;
  category?: string;
  previousStatus: string;
  nextStatus: "finance_confirmed";
  actorUserId: string;
  actorName?: string;
  exportDraftCandidateRows: number;
  financeOnlyRows: number;
  internalRiskOnlyRows: number;
  addonOnlyRows: number;
  blockedRows: number;
  ignoredRows: number;
  confirmationNote?: string;
};

export type ConfirmQuoteSourceStagingBatchResult = {
  batchId: string;
  previousStatus: string;
  nextStatus: "finance_confirmed";
  confirmedByUserId: string;
  confirmedByName?: string;
  confirmedAt: string;
  exportDraftCandidateRows: number;
  financeOnlyRows: number;
  internalRiskOnlyRows: number;
  addonOnlyRows: number;
  blockedRows: number;
  ignoredRows: number;
  warnings: string[];
  auditMetadata: QuoteSourceStagingFinanceConfirmedAuditMetadata;
};

const PRICE_BOUNDARY_WARNINGS = [
  "finance_confirmed 只表示财务确认 staging batch 可作为报价草稿候选数据源。",
  "export_draft_candidate 仍然不是正式报价，不能直接发客户。",
  "价格候选不是财务批准价格，正式报价必须后续接 FinancePricing。"
];

export async function confirmQuoteSourceStagingBatchForDraftCandidates(
  prisma: QuoteSourceStagingConfirmationPrisma,
  input: ConfirmQuoteSourceStagingBatchInput,
  options: QuoteSourceStagingRepositoryOptions = {}
): Promise<ConfirmQuoteSourceStagingBatchResult> {
  assertNonProductionDatabaseUrl(options.databaseUrl);

  if (!input.actorUserId.trim()) {
    throw new Error("actorUserId is required to confirm quote source staging batch");
  }

  const policy = input.rowVisibilityPolicy ?? "strict_candidate_only";

  return prisma.$transaction(async (tx) => {
    const batch = await tx.quoteSourceStagingBatch.findUnique({
      where: { id: input.batchId },
      include: { rows: true }
    });

    if (!batch) {
      throw new Error("quote source staging batch not found");
    }

    const previousStatus = batch.status as QuoteSourceStagingBatchStatus;
    assertQuoteSourceStagingBatchTransition(previousStatus, "finance_confirmed");

    const promotableRowIds = batch.rows
      .filter((row) => canPromoteRowToExportDraftCandidate(row, policy))
      .map((row) => row.id);

    if (promotableRowIds.length > 0) {
      await tx.quoteSourceStagingRow.updateMany({
        where: { id: { in: promotableRowIds } },
        data: { visibility: "export_draft_candidate" }
      });
    }

    const confirmedAt = new Date();
    const confirmedBatch = await tx.quoteSourceStagingBatch.update({
      where: { id: batch.id },
      data: {
        status: "finance_confirmed",
        confirmedByUserId: input.actorUserId,
        confirmedByName: input.actorName,
        confirmedAt,
        notes: input.confirmationNote ?? batch.notes ?? undefined
      }
    });

    const rowsAfterConfirmation = await tx.quoteSourceStagingRow.findMany({
      where: { batchId: batch.id }
    });
    const rowCounts = countConfirmedRows(rowsAfterConfirmation);

    return {
      batchId: batch.id,
      previousStatus,
      nextStatus: "finance_confirmed",
      confirmedByUserId: input.actorUserId,
      confirmedByName: input.actorName,
      confirmedAt: confirmedBatch.confirmedAt?.toISOString() ?? confirmedAt.toISOString(),
      ...rowCounts,
      warnings: PRICE_BOUNDARY_WARNINGS,
      auditMetadata: {
        batchId: batch.id,
        sourceFileName: batch.sourceFileName,
        adapterId: batch.adapterId,
        category: batch.category ?? undefined,
        previousStatus,
        nextStatus: "finance_confirmed",
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        ...rowCounts,
        confirmationNote: input.confirmationNote
      }
    };
  });
}

function canPromoteRowToExportDraftCandidate(
  row: StoredConfirmationRow,
  policy: ConfirmQuoteSourceStagingBatchInput["rowVisibilityPolicy"]
) {
  if (row.visibility !== "finance_only") {
    return false;
  }

  if (!canExposePriceCandidateToDraft(row.priceCandidateStatus as QuoteSourceStagingPriceCandidateStatus)) {
    return false;
  }

  if (row.rowStatus === "candidate") {
    return true;
  }

  if (policy === "include_manual_review" && row.rowStatus === "needs_manual_review") {
    return true;
  }

  return false;
}

function canExposePriceCandidateToDraft(status: QuoteSourceStagingPriceCandidateStatus) {
  return (
    status === "cost_candidate_available" ||
    status === "quote_candidate_available" ||
    status === "not_finance_approved"
  );
}

function countConfirmedRows(
  rows: Array<{
    rowStatus: string;
    visibility: string;
  }>
) {
  return {
    exportDraftCandidateRows: countBy(rows, "visibility", "export_draft_candidate"),
    financeOnlyRows: countBy(rows, "visibility", "finance_only"),
    internalRiskOnlyRows: countBy(rows, "visibility", "internal_risk_only"),
    addonOnlyRows: countBy(rows, "rowStatus", "addon_only"),
    blockedRows: countBy(rows, "rowStatus", "blocked"),
    ignoredRows: countBy(rows, "rowStatus", "ignored")
  } satisfies Record<string, number>;
}

function countBy(
  rows: Array<{
    rowStatus: string;
    visibility: string;
  }>,
  key: "rowStatus" | "visibility",
  value: QuoteSourceStagingRowStatus | QuoteSourceStagingVisibility
) {
  return rows.filter((row) => row[key] === value).length;
}
