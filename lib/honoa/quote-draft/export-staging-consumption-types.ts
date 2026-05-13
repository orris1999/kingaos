import type {
  QuoteSourceStagingBatchStatus,
  QuoteSourceStagingPriceCandidateStatus,
  QuoteSourceStagingRowStatus,
  QuoteSourceStagingTradeMode,
  QuoteSourceStagingVisibility
} from "./source-staging-types";

export type ExportQuoteDraftSource = "finance_confirmed_staging";

export type ExportQuoteDraftSourceCandidatePriceStatus =
  | "cost_candidate_available"
  | "quote_candidate_available"
  | "not_finance_approved";

export type ExportQuoteDraftSourceCandidate = {
  source: ExportQuoteDraftSource;
  stagingBatchId: string;
  stagingRowId: string;

  standardKjCode?: string;
  baseKjCode?: string;
  oldKjNo?: string;

  productNameCandidate?: string;
  category?: string;
  modelCandidate?: string;
  specificationCandidate?: string;

  tradeMode: QuoteSourceStagingTradeMode;

  priceCandidateStatus: ExportQuoteDraftSourceCandidatePriceStatus;

  hasCostCandidate: boolean;
  hasQuoteCandidate: boolean;
  hasPackagingInfo: boolean;
  hasOemInfo: boolean;

  warnings: string[];
};

export type FindExportQuoteDraftSourceCandidatesInput = {
  kjCode?: string;
  normalizedKjCode?: string;
  category?: string;
  tradeMode?: QuoteSourceStagingTradeMode;
  limit?: number;
};

export type NormalizedFindExportQuoteDraftSourceCandidatesInput =
  FindExportQuoteDraftSourceCandidatesInput & {
    limit: number;
  };

export type ExportQuoteDraftSourceCandidateQueryUnsupportedReason =
  | "missing_kj_code"
  | "oem_matching_not_supported";

export type ExportQuoteDraftSourceCandidateQueryDecision =
  | {
      supported: true;
      input: NormalizedFindExportQuoteDraftSourceCandidatesInput;
      warnings: string[];
    }
  | {
      supported: false;
      unsupportedReason: ExportQuoteDraftSourceCandidateQueryUnsupportedReason;
      requiresTechnicalReview: boolean;
      input: NormalizedFindExportQuoteDraftSourceCandidatesInput;
      warnings: string[];
    };

export type ExportReadableQuoteSourceStagingBatch = {
  id: string;
  status: QuoteSourceStagingBatchStatus;
};

export type ExportReadableQuoteSourceStagingRow = {
  id: string;
  standardKjCode?: string;
  baseKjCode?: string;
  oldKjNo?: string;
  productNameCandidate?: string;
  category?: string;
  modelCandidate?: string;
  specificationCandidate?: string;
  tradeMode?: QuoteSourceStagingTradeMode;
  priceCandidateStatus: QuoteSourceStagingPriceCandidateStatus;
  hasCostCandidate: boolean;
  hasQuoteCandidate: boolean;
  hasPackagingInfo: boolean;
  hasOemInfo: boolean;
  visibility: QuoteSourceStagingVisibility;
  rowStatus: QuoteSourceStagingRowStatus;
  warnings: string[];
};

const EXPORT_EXPOSABLE_PRICE_STATUSES: ExportQuoteDraftSourceCandidatePriceStatus[] = [
  "cost_candidate_available",
  "quote_candidate_available",
  "not_finance_approved"
];

const PRICE_BOUNDARY_WARNINGS = [
  "export_draft_candidate 仍然不是正式报价，不能直接发客户。",
  "价格候选不是财务批准价格，正式报价必须后续接 FinancePricing。"
];

const COMPLEX_CATEGORY_WARNING =
  "水箱 / 中冷器存在多编码、多规格、多包装字段，生成草稿前请确认。";

const SPECIAL_PACKAGING_WARNING =
  "特殊包装及其他只能作为包装 / 附加项候选，不能作为产品标准报价候选。";

function uniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function normalizeLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  const normalized = Math.trunc(limit ?? 20);
  if (normalized < 1) {
    return 1;
  }

  return Math.min(normalized, 50);
}

function normalizeQueryCode(value?: string) {
  return value?.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "");
}

function looksLikeOemOrOeCode(value?: string) {
  const normalized = normalizeQueryCode(value);
  if (!normalized) {
    return false;
  }

  return !normalized.includes("KJ") && /\d/.test(normalized);
}

function isWaterTankOrIntercooler(category?: string) {
  const normalized = category?.normalize("NFKC").trim().toLowerCase() ?? "";
  return (
    normalized.includes("水箱") ||
    normalized.includes("中冷器") ||
    normalized.includes("radiator") ||
    normalized.includes("intercooler")
  );
}

function isSpecialPackaging(category?: string) {
  const normalized = category?.normalize("NFKC").trim().toLowerCase() ?? "";
  return normalized.includes("特殊包装") || normalized.includes("packaging");
}

export function canExposeStagingRowToExportDraft(
  row: ExportReadableQuoteSourceStagingRow,
  batch: ExportReadableQuoteSourceStagingBatch
) {
  return (
    batch.status === "finance_confirmed" &&
    row.visibility === "export_draft_candidate" &&
    row.rowStatus === "candidate" &&
    EXPORT_EXPOSABLE_PRICE_STATUSES.includes(
      row.priceCandidateStatus as ExportQuoteDraftSourceCandidatePriceStatus
    ) &&
    !isSpecialPackaging(row.category)
  );
}

export function mapStagingRowToExportQuoteDraftSourceCandidate(
  row: ExportReadableQuoteSourceStagingRow,
  batch: ExportReadableQuoteSourceStagingBatch
): ExportQuoteDraftSourceCandidate {
  if (!canExposeStagingRowToExportDraft(row, batch)) {
    throw new Error("staging row cannot be exposed to export quote draft candidates");
  }

  return {
    source: "finance_confirmed_staging",
    stagingBatchId: batch.id,
    stagingRowId: row.id,
    standardKjCode: row.standardKjCode,
    baseKjCode: row.baseKjCode,
    oldKjNo: row.oldKjNo,
    productNameCandidate: row.productNameCandidate,
    category: row.category,
    modelCandidate: row.modelCandidate,
    specificationCandidate: row.specificationCandidate,
    tradeMode: row.tradeMode ?? "unknown",
    priceCandidateStatus: row.priceCandidateStatus as ExportQuoteDraftSourceCandidatePriceStatus,
    hasCostCandidate: row.hasCostCandidate,
    hasQuoteCandidate: row.hasQuoteCandidate,
    hasPackagingInfo: row.hasPackagingInfo,
    hasOemInfo: row.hasOemInfo,
    warnings: uniqueWarnings([
      ...PRICE_BOUNDARY_WARNINGS,
      ...(isWaterTankOrIntercooler(row.category) ? [COMPLEX_CATEGORY_WARNING] : []),
      ...row.warnings
    ])
  };
}

export function normalizeFindExportQuoteDraftSourceCandidatesInput(
  input: FindExportQuoteDraftSourceCandidatesInput
): NormalizedFindExportQuoteDraftSourceCandidatesInput {
  const kjCode = input.kjCode?.trim();
  const normalizedKjCode = input.normalizedKjCode?.trim();

  if (!kjCode && !normalizedKjCode) {
    throw new Error("kjCode or normalizedKjCode is required to find export quote draft source candidates");
  }

  if (looksLikeOemOrOeCode(kjCode) || looksLikeOemOrOeCode(normalizedKjCode)) {
    throw new Error("OEM / OE automatic matching is not supported for staging consumption");
  }

  return {
    ...input,
    kjCode,
    normalizedKjCode,
    limit: normalizeLimit(input.limit)
  };
}

export function getExportQuoteDraftSourceCandidateQueryDecision(
  input: FindExportQuoteDraftSourceCandidatesInput
): ExportQuoteDraftSourceCandidateQueryDecision {
  const normalizedInput = {
    ...input,
    kjCode: input.kjCode?.trim(),
    normalizedKjCode: input.normalizedKjCode?.trim(),
    limit: normalizeLimit(input.limit)
  };

  if (!normalizedInput.kjCode && !normalizedInput.normalizedKjCode) {
    return {
      supported: false,
      unsupportedReason: "missing_kj_code",
      requiresTechnicalReview: true,
      input: normalizedInput,
      warnings: ["请输入 KJ 或标准化 KJ 后再查询 staging 候选。"]
    };
  }

  if (looksLikeOemOrOeCode(normalizedInput.kjCode) || looksLikeOemOrOeCode(normalizedInput.normalizedKjCode)) {
    return {
      supported: false,
      unsupportedReason: "oem_matching_not_supported",
      requiresTechnicalReview: true,
      input: normalizedInput,
      warnings: ["OEM / OE 自动匹配暂未开放；请使用 KJ 查询，或提交技术人工确认。"]
    };
  }

  return {
    supported: true,
    input: normalizedInput,
    warnings: [
      "Export 只能读取 finance_confirmed + export_draft_candidate + candidate 的脱敏 staging 候选。",
      ...PRICE_BOUNDARY_WARNINGS
    ]
  };
}

export const EXPORT_STAGING_CONSUMPTION_WARNINGS = {
  priceBoundary: PRICE_BOUNDARY_WARNINGS,
  complexCategory: COMPLEX_CATEGORY_WARNING,
  specialPackaging: SPECIAL_PACKAGING_WARNING
} as const;
