import type {
  ExportQuoteDraftPreviewLine,
  ExportQuoteDraftPreviewSourceMode,
  ExportQuoteDraftPreviewStatus,
  ExportQuoteDraftPreviewTradeMode
} from "./export-quote-draft-preview";
import type { ExportQuoteDraftPreviewSummary } from "./export-quote-draft-preview-summary";

export type ExportQuoteDraftWorkbookCell = string | number;
export type ExportQuoteDraftWorkbookRow = ExportQuoteDraftWorkbookCell[];

const WORKBOOK_TITLE = "KingaOS 询价 / 报价草稿";
const NON_FORMAL_NOTICE = "非正式报价，仅供内部整理使用。";
const PRICE_BOUNDARY_NOTICE = "价格候选不是财务批准价格，不能直接发客户。";

const WORKBOOK_HEADERS = [
  "行号",
  "原始输入",
  "识别编码",
  "数量",
  "备注",
  "销售模式",
  "数据源",
  "预览状态",
  "KJ",
  "产品名称",
  "品类",
  "价格候选状态",
  "是否有成本候选",
  "是否有报价候选",
  "风险提示",
  "待处理事项"
];

const TRADE_MODE_LABELS: Record<ExportQuoteDraftPreviewTradeMode, string> = {
  export_usd: "外销 USD",
  domestic_cny: "内销 CNY",
  unknown: "未指定"
};

const SOURCE_MODE_LABELS: Record<ExportQuoteDraftPreviewSourceMode, string> = {
  mock: "Mock 数据",
  finance_confirmed_staging: "财务确认 staging 候选"
};

const PREVIEW_STATUS_LABELS: Record<ExportQuoteDraftPreviewStatus, string> = {
  ready_for_draft_preview: "可生成草稿预览",
  not_found: "未找到候选",
  multiple_candidates: "多候选，需选择",
  manual_review_required: "需人工确认",
  unsupported_oem: "OEM 暂未开放",
  missing_quantity: "缺少数量",
  staging_disabled: "staging 数据源未开放",
  error: "错误"
};

const PRICE_CANDIDATE_STATUS_LABELS: Record<string, string> = {
  cost_candidate_available: "成本候选",
  quote_candidate_available: "报价候选",
  not_finance_approved: "非财务批准价格，仅草稿候选",
  missing: "无价格候选",
  requires_finance_review: "需财务确认"
};

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function buildExportQuoteDraftExcelFileName(now = new Date()) {
  const year = now.getFullYear();
  const month = padDatePart(now.getMonth() + 1);
  const day = padDatePart(now.getDate());
  const hour = padDatePart(now.getHours());
  const minute = padDatePart(now.getMinutes());

  return `KingaOS-询价报价草稿-${year}${month}${day}-${hour}${minute}.xlsx`;
}

function priceCandidateStatusLabel(status?: string) {
  if (!status) return "";
  return PRICE_CANDIDATE_STATUS_LABELS[status] ?? status;
}

function yesNo(value?: boolean) {
  return value ? "是" : "否";
}

function getLineActionItem(line: ExportQuoteDraftPreviewLine) {
  const items: string[] = [];

  if (line.previewStatus === "missing_quantity") {
    items.push("缺少数量，请补充数量。");
  }
  if (line.previewStatus === "not_found") {
    items.push("未找到财务确认 staging 候选，请核对 KJ 或联系财务 / 技术。");
  }
  if (line.previewStatus === "multiple_candidates") {
    items.push("多候选，需要选择正确 KJ。");
  }
  if (line.previewStatus === "manual_review_required") {
    items.push("需人工确认编码、包装或风险说明。");
  }
  if (line.previewStatus === "unsupported_oem") {
    items.push("OEM 暂未开放，请先通过技术确认找到 KJ。");
  }
  if (line.previewStatus === "staging_disabled") {
    items.push("staging 数据源未开放。");
  }
  if (line.priceCandidateStatus === "not_finance_approved") {
    items.push(PRICE_BOUNDARY_NOTICE);
  }

  return items.join("；");
}

export function buildExportQuoteDraftWorkbookRows(
  lines: ExportQuoteDraftPreviewLine[],
  summary: ExportQuoteDraftPreviewSummary
): ExportQuoteDraftWorkbookRow[] {
  const actionItems = summary.actionItems.length > 0
    ? summary.actionItems.map((item) => item.message).join("\n")
    : "暂无待处理事项。";

  return [
    [WORKBOOK_TITLE],
    [NON_FORMAL_NOTICE],
    [PRICE_BOUNDARY_NOTICE],
    [],
    ["总行数", summary.total, "可生成草稿预览", summary.ready, "未找到候选", summary.notFound],
    [
      "多候选",
      summary.multipleCandidates,
      "需人工确认",
      summary.manualReview,
      "缺少数量",
      summary.missingQuantity
    ],
    ["OEM 暂未开放", summary.unsupportedOem, "非财务批准价格", summary.notFinanceApproved],
    ["待处理事项", actionItems],
    [],
    WORKBOOK_HEADERS,
    ...lines.map((line) => [
      line.lineNo,
      line.rawInput,
      line.requestedCode || "",
      line.quantity ?? "",
      line.customerNote ?? "",
      TRADE_MODE_LABELS[line.tradeMode],
      SOURCE_MODE_LABELS[line.sourceMode],
      PREVIEW_STATUS_LABELS[line.previewStatus],
      line.kjCode ?? "",
      line.productNameCandidate ?? "",
      line.category ?? "",
      priceCandidateStatusLabel(line.priceCandidateStatus),
      yesNo(line.hasCostCandidate),
      yesNo(line.hasQuoteCandidate),
      line.warnings.join("；"),
      getLineActionItem(line)
    ])
  ];
}
