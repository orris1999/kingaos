import type { QuoteSourceDryRunDecisionStatus } from "./source-dry-run-decision";
import type {
  CreateQuoteSourceStagingBatchInput,
  CreateQuoteSourceStagingRowInput
} from "./source-staging-repository-types";
import type {
  QuoteSourceStagingBatchStatus,
  QuoteSourceStagingPriceCandidateStatus,
  QuoteSourceStagingRowStatus,
  QuoteSourceStagingTradeMode,
  QuoteSourceStagingVisibility
} from "./source-staging-types";

export type QuoteSourceDryRunToStagingInput = {
  sourceFileName: string;
  adapterId: string;
  category?: string;
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus;
  submittedByRole?: "finance";
  consumerDepartment?: "export";
  createdByUserId?: string;
  createdByName?: string;
  warnings?: string[];
  notes?: string;
  rows?: QuoteSourceDryRunToStagingRowInput[];
};

export type QuoteSourceDryRunToStagingRowInput = {
  sourceRowNumber?: number;
  rawKjCode?: string;
  standardKjCode?: string;
  baseKjCode?: string;
  oldKjNo?: string;
  fumacrmCode?: string;
  dingjieCodeWithoutCap?: string;
  dingjieCodeWithCap?: string;
  productNameCandidate?: string;
  category?: string;
  modelCandidate?: string;
  specificationCandidate?: string;
  tradeMode?: QuoteSourceStagingTradeMode;
  priceCandidateStatus: QuoteSourceStagingPriceCandidateStatus;
  hasCostCandidate?: boolean;
  hasQuoteCandidate?: boolean;
  hasPackagingInfo?: boolean;
  hasOemInfo?: boolean;
  visibility: QuoteSourceStagingVisibility;
  rowStatus: QuoteSourceStagingRowStatus;
  warnings?: string[];
};

export type QuoteSourceMappedStagingRowInput = Omit<CreateQuoteSourceStagingRowInput, "batchId">;

export type QuoteSourceDryRunToStagingMappedInput = {
  batch: CreateQuoteSourceStagingBatchInput;
  rows: QuoteSourceMappedStagingRowInput[];
  auditMetadata: QuoteSourceStagingMappedFromDryRunAuditMetadata;
};

export type QuoteSourceStagingMappedFromDryRunAuditMetadata = {
  sourceFileName: string;
  adapterId: string;
  category?: string;
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus;
  batchStatus: QuoteSourceStagingBatchStatus;
  rowCount: number;
  actorUserId?: string;
  actorName?: string;
};

const SENSITIVE_PRICE_FIELDS = [
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
] as const;

const PRICE_BOUNDARY_WARNING = "staging mapper 只处理结构 metadata，价格候选不是财务批准价格。";
const EXPORT_VISIBILITY_WARNING = "dry-run 阶段不会直接生成 export_draft_candidate，需后续财务确认 action。";

export function mapDryRunDecisionStatusToStagingBatchStatus(
  status: QuoteSourceDryRunDecisionStatus
): QuoteSourceStagingBatchStatus {
  switch (status) {
    case "ready_for_staging_design":
    case "addon_only":
    case "manual_review_required":
      return "dry_run_passed";
    case "needs_finance_table_fix":
      return "finance_table_fix_required";
    case "needs_adapter_fix":
      return "adapter_fix_required";
    case "blocked":
      return "cancelled";
  }
}

export function mapDryRunToQuoteSourceStagingBatchInput(
  input: QuoteSourceDryRunToStagingInput
): CreateQuoteSourceStagingBatchInput {
  assertNoSensitivePriceFields(input);

  const status = mapDryRunDecisionStatusToStagingBatchStatus(input.dryRunDecisionStatus);

  return {
    sourceFileName: input.sourceFileName,
    adapterId: input.adapterId,
    category: input.category,
    submittedByRole: input.submittedByRole ?? "finance",
    consumerDepartment: input.consumerDepartment ?? "export",
    dryRunDecisionStatus: input.dryRunDecisionStatus,
    status,
    createdByUserId: input.createdByUserId,
    createdByName: input.createdByName,
    warnings: unique([
      ...(input.warnings ?? []),
      PRICE_BOUNDARY_WARNING,
      status === "cancelled" ? "blocked dry-run 结果只能映射为 cancelled staging batch。" : ""
    ]),
    notes: input.notes
  };
}

export function mapDryRunToQuoteSourceStagingInput(
  input: QuoteSourceDryRunToStagingInput
): QuoteSourceDryRunToStagingMappedInput {
  const batch = mapDryRunToQuoteSourceStagingBatchInput(input);
  const rows = mapDryRunRowsToMappedQuoteSourceStagingRows(
    input.rows ?? [],
    input.dryRunDecisionStatus
  );

  return {
    batch,
    rows,
    auditMetadata: {
      sourceFileName: input.sourceFileName,
      adapterId: input.adapterId,
      category: input.category,
      dryRunDecisionStatus: input.dryRunDecisionStatus,
      batchStatus: batch.status ?? "draft",
      rowCount: rows.length,
      actorUserId: input.createdByUserId,
      actorName: input.createdByName
    }
  };
}

export function mapDryRunRowsToMappedQuoteSourceStagingRows(
  rows: QuoteSourceDryRunToStagingRowInput[],
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus
): QuoteSourceMappedStagingRowInput[] {
  assertNoSensitivePriceFields(rows);

  return rows.map((row) => {
    const rowStatus = getStagingRowStatus(row, dryRunDecisionStatus);
    const visibility = getConservativeVisibility(rowStatus, row.visibility);

    return {
      sourceRowNumber: row.sourceRowNumber,
      rawKjCode: row.rawKjCode,
      standardKjCode: row.standardKjCode,
      baseKjCode: row.baseKjCode,
      oldKjNo: row.oldKjNo,
      fumacrmCode: row.fumacrmCode,
      dingjieCodeWithoutCap: row.dingjieCodeWithoutCap,
      dingjieCodeWithCap: row.dingjieCodeWithCap,
      productNameCandidate: row.productNameCandidate,
      category: row.category,
      modelCandidate: row.modelCandidate,
      specificationCandidate: row.specificationCandidate,
      tradeMode: row.tradeMode ?? "unknown",
      priceCandidateStatus: row.priceCandidateStatus,
      hasCostCandidate: row.hasCostCandidate ?? row.priceCandidateStatus === "cost_candidate_available",
      hasQuoteCandidate: row.hasQuoteCandidate ?? row.priceCandidateStatus === "quote_candidate_available",
      hasPackagingInfo: row.hasPackagingInfo ?? false,
      hasOemInfo: row.hasOemInfo ?? false,
      visibility,
      rowStatus,
      warnings: unique([
        ...(row.warnings ?? []),
        PRICE_BOUNDARY_WARNING,
        row.visibility === "export_draft_candidate" ? EXPORT_VISIBILITY_WARNING : "",
        rowStatus === "addon_only" ? "附加项候选不能作为产品标准报价行。" : "",
        rowStatus === "blocked" ? "阻断行不能给出口部消费。" : "",
        rowStatus === "ignored" ? "忽略行不能给出口部消费。" : "",
        rowStatus === "needs_manual_review" ? "该行需要人工确认后才能进入后续候选流程。" : ""
      ])
    };
  });
}

export function mapDryRunRowsToQuoteSourceStagingRowInputs(
  batchId: string,
  rows: QuoteSourceDryRunToStagingRowInput[],
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus
): CreateQuoteSourceStagingRowInput[] {
  return mapDryRunRowsToMappedQuoteSourceStagingRows(rows, dryRunDecisionStatus).map((row) => ({
    ...row,
    batchId
  }));
}

export function attachQuoteSourceStagingBatchIdToRows(
  batchId: string,
  rows: QuoteSourceMappedStagingRowInput[]
): CreateQuoteSourceStagingRowInput[] {
  return rows.map((row) => ({ ...row, batchId }));
}

function getStagingRowStatus(
  row: QuoteSourceDryRunToStagingRowInput,
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus
): QuoteSourceStagingRowStatus {
  if (dryRunDecisionStatus === "addon_only") {
    return "addon_only";
  }

  if (dryRunDecisionStatus === "blocked") {
    return "blocked";
  }

  if (dryRunDecisionStatus === "manual_review_required" && row.rowStatus === "candidate") {
    return "needs_manual_review";
  }

  return row.rowStatus;
}

function getConservativeVisibility(
  rowStatus: QuoteSourceStagingRowStatus,
  requestedVisibility: QuoteSourceStagingVisibility
): QuoteSourceStagingVisibility {
  if (rowStatus === "blocked" || rowStatus === "ignored") {
    return requestedVisibility === "finance_only" ? "finance_only" : "internal_risk_only";
  }

  if (rowStatus === "addon_only") {
    return requestedVisibility === "internal_risk_only" ? "internal_risk_only" : "finance_only";
  }

  if (rowStatus === "needs_manual_review") {
    return requestedVisibility === "internal_risk_only" ? "internal_risk_only" : "finance_only";
  }

  return "finance_only";
}

function assertNoSensitivePriceFields(value: unknown, path: string[] = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitivePriceFields(item, [...path, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (SENSITIVE_PRICE_FIELDS.includes(key as (typeof SENSITIVE_PRICE_FIELDS)[number])) {
      throw new Error(
        `staging metadata cannot include sensitive price fields: ${[...path, key].join(".")}`
      );
    }

    assertNoSensitivePriceFields((value as Record<string, unknown>)[key], [...path, key]);
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
