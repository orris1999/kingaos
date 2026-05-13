import { generateV1QuoteDraftCandidates } from "./v1-draft-rules";
import { parseQuoteDraftInput } from "./input-parser";
import { QUOTE_DRAFT_MOCK_CATALOG } from "./mock-catalog";
import type { ExportQuoteDraftSourceCandidate } from "./export-staging-consumption-types";
import type { QuoteDraftInputLine, QuoteDraftRequestedCodeType } from "./types";

export type ExportQuoteDraftPreviewTradeMode = "export_usd" | "domestic_cny" | "unknown";

export type ExportQuoteDraftPreviewSourceMode = "mock" | "finance_confirmed_staging";

export type ExportQuoteDraftPreviewStatus =
  | "ready_for_draft_preview"
  | "not_found"
  | "multiple_candidates"
  | "manual_review_required"
  | "unsupported_oem"
  | "missing_quantity"
  | "staging_disabled"
  | "error";

export type ExportQuoteDraftPreviewLine = {
  lineNo: number;
  rawInput: string;
  requestedCode: string;
  requestedCodeType: QuoteDraftRequestedCodeType;
  quantity?: number;
  customerNote?: string;
  tradeMode: ExportQuoteDraftPreviewTradeMode;
  sourceMode: ExportQuoteDraftPreviewSourceMode;
  previewStatus: ExportQuoteDraftPreviewStatus;
  kjCode?: string;
  productNameCandidate?: string;
  category?: string;
  priceCandidateStatus?: string;
  hasCostCandidate?: boolean;
  hasQuoteCandidate?: boolean;
  warnings: string[];
};

export type BuildExportQuoteDraftPreviewInput = {
  inputText: string;
  tradeMode: ExportQuoteDraftPreviewTradeMode;
  sourceMode: ExportQuoteDraftPreviewSourceMode;
  stagingCandidatesByLine?: Record<number, ExportQuoteDraftSourceCandidate[]>;
  stagingEnabled?: boolean;
};

const PRICE_BOUNDARY_WARNINGS = [
  "报价草稿预览不是正式报价，不能直接发客户。",
  "价格候选不是财务批准价格，正式报价必须后续接 FinancePricing。"
];

const NOT_FINANCE_APPROVED_WARNING = "非财务批准价格，仅草稿候选，不是正式报价。";

function uniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function hasMissingQuantity(line: QuoteDraftInputLine) {
  return line.quantity === undefined || !Number.isFinite(line.quantity) || line.quantity <= 0;
}

function isUnsupportedOem(line: QuoteDraftInputLine) {
  return line.requestedCodeType === "oem" || line.requestedCodeType === "oe";
}

function basePreviewLine(
  line: QuoteDraftInputLine,
  lineNo: number,
  input: Pick<BuildExportQuoteDraftPreviewInput, "tradeMode" | "sourceMode">
) {
  return {
    lineNo,
    rawInput: line.rawInput,
    requestedCode: line.requestedCode,
    requestedCodeType: line.requestedCodeType,
    quantity: line.quantity,
    customerNote: line.customerNote,
    tradeMode: input.tradeMode,
    sourceMode: input.sourceMode
  };
}

function getMockPreviewStatus(
  line: QuoteDraftInputLine,
  candidate: ReturnType<typeof generateV1QuoteDraftCandidates>[number]
): ExportQuoteDraftPreviewStatus {
  if (isUnsupportedOem(line)) return "unsupported_oem";
  if (candidate.matchStatus === "kj_not_found") return "not_found";
  if (candidate.matchStatus === "ambiguous_kj") return "multiple_candidates";
  if (candidate.requiresManualConfirmation || candidate.matchStatus === "requires_technical_review") {
    return "manual_review_required";
  }
  if (hasMissingQuantity(line)) return "missing_quantity";
  return "ready_for_draft_preview";
}

function mapMockPriceCandidateStatus(candidate: ReturnType<typeof generateV1QuoteDraftCandidates>[number]) {
  if (candidate.priceStatus === "candidate_cost_available") return "cost_candidate_available";
  if (candidate.priceStatus === "candidate_quote_available") return "quote_candidate_available";
  if (candidate.priceStatus === "not_finance_approved") return "not_finance_approved";
  return candidate.priceStatus;
}

function buildMockPreviewLines(
  inputLines: QuoteDraftInputLine[],
  input: Pick<BuildExportQuoteDraftPreviewInput, "tradeMode" | "sourceMode">
): ExportQuoteDraftPreviewLine[] {
  const candidates = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

  return candidates.map((candidate, index) => {
    const line = inputLines[index];
    const priceCandidateStatus = mapMockPriceCandidateStatus(candidate);
    return {
      ...basePreviewLine(line, index + 1, input),
      previewStatus: getMockPreviewStatus(line, candidate),
      kjCode: candidate.kjCode,
      productNameCandidate: candidate.productName,
      category: candidate.category,
      priceCandidateStatus,
      hasCostCandidate: priceCandidateStatus === "cost_candidate_available" || priceCandidateStatus === "not_finance_approved",
      hasQuoteCandidate: priceCandidateStatus === "quote_candidate_available",
      warnings: uniqueWarnings([
        ...candidate.warnings,
        ...PRICE_BOUNDARY_WARNINGS,
        ...(hasMissingQuantity(line) ? ["缺少数量，请人工确认。"] : []),
        ...(priceCandidateStatus === "not_finance_approved" ? [NOT_FINANCE_APPROVED_WARNING] : [])
      ])
    };
  });
}

function buildStagingPreviewLine(
  line: QuoteDraftInputLine,
  lineNo: number,
  input: BuildExportQuoteDraftPreviewInput
): ExportQuoteDraftPreviewLine {
  const base = basePreviewLine(line, lineNo, input);

  if (input.stagingEnabled === false) {
    return {
      ...base,
      previewStatus: "staging_disabled",
      warnings: uniqueWarnings([...line.warnings, "staging 数据源未开放。"])
    };
  }

  if (isUnsupportedOem(line)) {
    return {
      ...base,
      previewStatus: "unsupported_oem",
      warnings: uniqueWarnings([
        ...line.warnings,
        "OEM 自动匹配暂未开放。请使用 KJ 查询，或提交技术人工确认。"
      ])
    };
  }

  const candidates = input.stagingCandidatesByLine?.[lineNo] ?? [];
  if (candidates.length === 0) {
    return {
      ...base,
      previewStatus: "not_found",
      warnings: uniqueWarnings([
        ...line.warnings,
        "未找到财务确认的 staging 候选。",
        ...PRICE_BOUNDARY_WARNINGS
      ])
    };
  }

  if (candidates.length > 1) {
    return {
      ...base,
      previewStatus: "multiple_candidates",
      warnings: uniqueWarnings([
        ...line.warnings,
        "找到多个财务确认 staging 候选，需人工选择，不能自动取第一行。",
        ...PRICE_BOUNDARY_WARNINGS
      ])
    };
  }

  const candidate = candidates[0];
  const previewStatus: ExportQuoteDraftPreviewStatus = hasMissingQuantity(line)
    ? "missing_quantity"
    : "ready_for_draft_preview";

  return {
    ...base,
    previewStatus,
    kjCode: candidate.standardKjCode ?? candidate.baseKjCode ?? candidate.oldKjNo,
    productNameCandidate: candidate.productNameCandidate,
    category: candidate.category,
    priceCandidateStatus: candidate.priceCandidateStatus,
    hasCostCandidate: candidate.hasCostCandidate,
    hasQuoteCandidate: candidate.hasQuoteCandidate,
    warnings: uniqueWarnings([
      ...line.warnings,
      ...candidate.warnings,
      ...PRICE_BOUNDARY_WARNINGS,
      ...(hasMissingQuantity(line) ? ["缺少数量，请人工确认。"] : []),
      ...(candidate.priceCandidateStatus === "not_finance_approved" ? [NOT_FINANCE_APPROVED_WARNING] : [])
    ])
  };
}

export function buildExportQuoteDraftPreviewLines(
  input: BuildExportQuoteDraftPreviewInput
): ExportQuoteDraftPreviewLine[] {
  const inputLines = parseQuoteDraftInput(input.inputText);

  if (input.sourceMode === "mock") {
    return buildMockPreviewLines(inputLines, input);
  }

  return inputLines.map((line, index) => buildStagingPreviewLine(line, index + 1, input));
}
