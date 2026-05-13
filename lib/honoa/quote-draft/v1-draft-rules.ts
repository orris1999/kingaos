import { generateQuoteDraftCandidates } from "./draft-generator";
import { getQuoteV1SourceReadiness } from "./v1-source-readiness";
import type { QuoteDraftCatalogItem, QuoteDraftInputLine, QuoteDraftLineCandidate } from "./types";

function uniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function applyV1Readiness(candidate: QuoteDraftLineCandidate): QuoteDraftLineCandidate {
  if (candidate.matchStatus === "oem_not_supported_yet") {
    const readiness = getQuoteV1SourceReadiness("");
    return {
      ...candidate,
      v1Readiness: readiness.readiness,
      v1ReadinessWarnings: uniqueWarnings([
        "OEM / OE 自动匹配暂未开放。",
        "V1 只支持 KJ 输入生成报价草稿。"
      ]),
      requiresManualConfirmation: true,
      isAddonOnly: false,
      warnings: uniqueWarnings([
        ...candidate.warnings,
        "OEM / OE 自动匹配暂未开放。",
        "V1 只支持 KJ 输入生成报价草稿。"
      ])
    };
  }

  if (candidate.matchStatus === "ambiguous_kj") {
    const readiness = getQuoteV1SourceReadiness(candidate.category ?? "");
    const readinessWarnings = uniqueWarnings([
      ...readiness.warnings,
      "基础 KJ 多候选不能静默选择第一行，需人工确认。"
    ]);

    return {
      ...candidate,
      v1Readiness: readiness.readiness,
      v1ReadinessWarnings: readinessWarnings,
      requiresManualConfirmation: true,
      isAddonOnly: readiness.allowedAsAddonOnly,
      warnings: uniqueWarnings([...candidate.warnings, ...readinessWarnings])
    };
  }

  if (candidate.matchStatus !== "matched_by_kj") {
    const readiness = getQuoteV1SourceReadiness(candidate.category ?? "");
    return {
      ...candidate,
      v1Readiness: readiness.readiness,
      v1ReadinessWarnings: readiness.warnings,
      requiresManualConfirmation: true,
      isAddonOnly: false,
      warnings: uniqueWarnings([...candidate.warnings, ...readiness.warnings])
    };
  }

  const readiness = getQuoteV1SourceReadiness(candidate.category ?? "");
  const nextMatchStatus =
    readiness.readiness === "deferred" ? "requires_technical_review" : candidate.matchStatus;

  return {
    ...candidate,
    matchStatus: nextMatchStatus,
    v1Readiness: readiness.readiness,
    v1ReadinessWarnings: readiness.warnings,
    requiresManualConfirmation: readiness.requiresManualConfirmation,
    isAddonOnly: readiness.allowedAsAddonOnly,
    warnings: uniqueWarnings([...candidate.warnings, ...readiness.warnings])
  };
}

export function generateV1QuoteDraftCandidates(
  inputLines: QuoteDraftInputLine[],
  catalog: QuoteDraftCatalogItem[]
): QuoteDraftLineCandidate[] {
  return generateQuoteDraftCandidates(inputLines, catalog).map(applyV1Readiness);
}
