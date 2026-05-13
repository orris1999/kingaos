import { generateQuoteDraftCandidates } from "./draft-generator";
import { getQuoteV1SourceReadiness } from "./v1-source-readiness";
import type { QuoteDraftCatalogItem, QuoteDraftInputLine, QuoteDraftLineCandidate } from "./types";
import type { QuoteV1LineRisk, QuoteV1SourceReadinessResult } from "./v1-source-readiness";

const PRICE_BOUNDARY_LINE_WARNINGS = [
  "价格候选不是财务批准价格，不能直接发客户。",
  "V1 只生成报价草稿，不生成正式报价。"
];

const LINE_RISK_WARNING_LABELS: Record<QuoteV1LineRisk, string> = {
  base_kj_multi_candidate: "基础 KJ 可能对应多个候选，不能静默自动选择第一行。",
  old_kj_code_match: "旧 KJ.NO / 历史旧码匹配需要人工确认。",
  fumacrm_code_match: "孚盟编码匹配需要人工确认并映射到标准 KJ。",
  dingjie_code_match: "鼎捷编码匹配需要人工确认，不能只靠 ERP 编码静默报价。",
  oem_input_not_supported: "OEM / OE 自动匹配暂未开放。",
  special_sheet_match: "命中特殊 sheet 或特殊风险说明，不能进入 V1 主草稿自动消费。",
  sales_restriction_warning: "存在限销或风险说明，请下单前确认。",
  packaging_affects_price: "包装或特殊规格可能影响价格，需人工确认。",
  embedded_image_only: "图片只有 Excel 嵌入图，未归档为稳定主图。",
  multiple_candidates: "找到多个候选行，需要人工选择。",
  missing_required_spec: "规格信息不足，需人工确认。"
};

function uniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function getReadinessLabel(readiness: QuoteV1SourceReadinessResult, risks: QuoteV1LineRisk[]) {
  if (readiness.readiness === "addon_only") return "仅附加项候选";
  if (readiness.readiness === "deferred") return "暂缓";
  if (risks.length > 0 || readiness.readiness === "v1_manual_confirmation_required") return "需人工确认";
  return "可进入 V1 草稿";
}

function getLineRisks(candidate: QuoteDraftLineCandidate): QuoteV1LineRisk[] {
  const risks: QuoteV1LineRisk[] = [];
  const warningText = candidate.warnings.join("\n");

  if (candidate.matchStatus === "ambiguous_kj") {
    risks.push("base_kj_multi_candidate", "multiple_candidates");
  }

  if (candidate.sourceCodeType === "old_code") risks.push("old_kj_code_match");
  if (candidate.sourceCodeType === "fumacrm_code") risks.push("fumacrm_code_match");
  if (candidate.sourceCodeType === "erp_code") risks.push("dingjie_code_match");
  if (candidate.imageStatus === "embedded_only") risks.push("embedded_image_only");

  if (/不能生产|只做报价|不公布|不保质|漏水/.test(warningText)) {
    risks.push("special_sheet_match");
  }

  if (/限销|风险/.test(warningText)) {
    risks.push("sales_restriction_warning");
  }

  if (/包装影响价格|特殊包装|包装规格不明确/.test(warningText)) {
    risks.push("packaging_affects_price");
  }

  if (/规格信息不足|缺少规格/.test(warningText)) {
    risks.push("missing_required_spec");
  }

  return Array.from(new Set(risks));
}

function getLineWarnings(readiness: QuoteV1SourceReadinessResult, risks: QuoteV1LineRisk[]) {
  if (readiness.readiness === "addon_only" || readiness.readiness === "deferred") {
    return uniqueWarnings([...readiness.warnings, ...risks.map((risk) => LINE_RISK_WARNING_LABELS[risk])]);
  }

  if (risks.length > 0) {
    return uniqueWarnings([...PRICE_BOUNDARY_LINE_WARNINGS, ...risks.map((risk) => LINE_RISK_WARNING_LABELS[risk])]);
  }

  return PRICE_BOUNDARY_LINE_WARNINGS;
}

function applyV1Readiness(candidate: QuoteDraftLineCandidate): QuoteDraftLineCandidate {
  if (candidate.matchStatus === "oem_not_supported_yet") {
    const readiness = getQuoteV1SourceReadiness("");
    const risks: QuoteV1LineRisk[] = ["oem_input_not_supported"];
    const readinessWarnings = uniqueWarnings([
      ...PRICE_BOUNDARY_LINE_WARNINGS,
      LINE_RISK_WARNING_LABELS.oem_input_not_supported,
      "V1 只支持 KJ 输入生成报价草稿。"
    ]);
    return {
      ...candidate,
      v1Readiness: readiness.readiness,
      v1ReadinessLabel: "暂缓",
      v1LineRisks: risks,
      v1ReadinessWarnings: readinessWarnings,
      requiresManualConfirmation: true,
      isAddonOnly: false,
      warnings: uniqueWarnings([
        ...candidate.warnings,
        LINE_RISK_WARNING_LABELS.oem_input_not_supported,
        "V1 只支持 KJ 输入生成报价草稿。"
      ])
    };
  }

  if (candidate.matchStatus === "ambiguous_kj") {
    const readiness = getQuoteV1SourceReadiness(candidate.category ?? "");
    const risks = getLineRisks(candidate);
    const readinessWarnings = getLineWarnings(readiness, risks);

    return {
      ...candidate,
      v1Readiness: readiness.readiness,
      v1ReadinessLabel: getReadinessLabel(readiness, risks),
      v1LineRisks: risks,
      v1ReadinessWarnings: readinessWarnings,
      requiresManualConfirmation: true,
      isAddonOnly: readiness.allowedAsAddonOnly,
      warnings: uniqueWarnings([...candidate.warnings, ...readinessWarnings])
    };
  }

  if (candidate.matchStatus !== "matched_by_kj") {
    const readiness = getQuoteV1SourceReadiness(candidate.category ?? "");
    const risks = getLineRisks(candidate);
    return {
      ...candidate,
      v1Readiness: readiness.readiness,
      v1ReadinessLabel: readiness.readiness === "deferred" ? "暂缓" : "需人工确认",
      v1LineRisks: risks,
      v1ReadinessWarnings: getLineWarnings(readiness, risks),
      requiresManualConfirmation: true,
      isAddonOnly: false,
      warnings: uniqueWarnings([...candidate.warnings, ...getLineWarnings(readiness, risks)])
    };
  }

  const readiness = getQuoteV1SourceReadiness(candidate.category ?? "");
  const risks = getLineRisks(candidate);
  const nextMatchStatus = readiness.readiness === "deferred" ? "requires_technical_review" : candidate.matchStatus;
  const readinessWarnings = getLineWarnings(readiness, risks);
  const requiresManualConfirmation = readiness.requiresManualConfirmation || risks.length > 0;

  return {
    ...candidate,
    matchStatus: nextMatchStatus,
    v1Readiness: readiness.readiness,
    v1ReadinessLabel: getReadinessLabel(readiness, risks),
    v1LineRisks: risks,
    v1ReadinessWarnings: readinessWarnings,
    requiresManualConfirmation,
    isAddonOnly: readiness.allowedAsAddonOnly,
    warnings: uniqueWarnings([...candidate.warnings, ...readinessWarnings])
  };
}

export function generateV1QuoteDraftCandidates(
  inputLines: QuoteDraftInputLine[],
  catalog: QuoteDraftCatalogItem[]
): QuoteDraftLineCandidate[] {
  return generateQuoteDraftCandidates(inputLines, catalog).map(applyV1Readiness);
}
