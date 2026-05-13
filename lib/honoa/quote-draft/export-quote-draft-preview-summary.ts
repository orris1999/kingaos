import type { ExportQuoteDraftPreviewLine } from "./export-quote-draft-preview";

export type ExportQuoteDraftPreviewActionItemType =
  | "missing_quantity"
  | "not_found"
  | "multiple_candidates"
  | "manual_review_required"
  | "unsupported_oem"
  | "not_finance_approved";

export type ExportQuoteDraftPreviewActionItem = {
  type: ExportQuoteDraftPreviewActionItemType;
  count: number;
  message: string;
  severity: "warning" | "danger" | "muted";
};

export type ExportQuoteDraftPreviewSummary = {
  total: number;
  ready: number;
  notFound: number;
  multipleCandidates: number;
  manualReview: number;
  missingQuantity: number;
  unsupportedOem: number;
  notFinanceApproved: number;
  actionItems: ExportQuoteDraftPreviewActionItem[];
};

function countBy(lines: ExportQuoteDraftPreviewLine[], predicate: (line: ExportQuoteDraftPreviewLine) => boolean) {
  return lines.filter(predicate).length;
}

function makeActionItem(
  type: ExportQuoteDraftPreviewActionItemType,
  count: number,
  message: string,
  severity: ExportQuoteDraftPreviewActionItem["severity"]
): ExportQuoteDraftPreviewActionItem | undefined {
  if (count <= 0) return undefined;
  return { type, count, message, severity };
}

export function summarizeExportQuoteDraftPreviewLines(
  lines: ExportQuoteDraftPreviewLine[]
): ExportQuoteDraftPreviewSummary {
  const summary = {
    total: lines.length,
    ready: countBy(lines, (line) => line.previewStatus === "ready_for_draft_preview"),
    notFound: countBy(lines, (line) => line.previewStatus === "not_found"),
    multipleCandidates: countBy(lines, (line) => line.previewStatus === "multiple_candidates"),
    manualReview: countBy(lines, (line) => line.previewStatus === "manual_review_required"),
    missingQuantity: countBy(lines, (line) => line.previewStatus === "missing_quantity"),
    unsupportedOem: countBy(lines, (line) => line.previewStatus === "unsupported_oem"),
    notFinanceApproved: countBy(lines, (line) => line.priceCandidateStatus === "not_finance_approved")
  };

  const actionItems = [
    makeActionItem(
      "missing_quantity",
      summary.missingQuantity,
      `有 ${summary.missingQuantity} 行缺少数量，请补充数量。`,
      "warning"
    ),
    makeActionItem(
      "not_found",
      summary.notFound,
      `有 ${summary.notFound} 行未找到财务确认 staging 候选，请核对 KJ 或联系财务 / 技术。`,
      "danger"
    ),
    makeActionItem(
      "multiple_candidates",
      summary.multipleCandidates,
      `有 ${summary.multipleCandidates} 行多候选，需要选择正确 KJ。`,
      "warning"
    ),
    makeActionItem(
      "manual_review_required",
      summary.manualReview,
      `有 ${summary.manualReview} 行需人工确认，请确认编码、包装或风险说明。`,
      "warning"
    ),
    makeActionItem(
      "unsupported_oem",
      summary.unsupportedOem,
      `有 ${summary.unsupportedOem} 行 OEM 暂未开放，请先通过技术确认找到 KJ。`,
      "muted"
    ),
    makeActionItem(
      "not_finance_approved",
      summary.notFinanceApproved,
      `有 ${summary.notFinanceApproved} 行价格候选不是财务批准价格，不能直接发客户。`,
      "warning"
    )
  ].filter((item): item is ExportQuoteDraftPreviewActionItem => Boolean(item));

  return { ...summary, actionItems };
}
