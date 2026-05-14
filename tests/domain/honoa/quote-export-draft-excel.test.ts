import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExportQuoteDraftExcelFileName,
  buildExportQuoteDraftWorkbookRows,
  summarizeExportQuoteDraftPreviewLines,
  type ExportQuoteDraftPreviewLine
} from "@/lib/honoa/quote-draft";
import { isExportQuoteDraftExcelEnabled } from "@/lib/honoa/server/feature-flags";

function makeLine(overrides: Partial<ExportQuoteDraftPreviewLine> = {}): ExportQuoteDraftPreviewLine {
  return {
    lineNo: 1,
    rawInput: "KJMOCK-COND-001 10",
    requestedCode: "KJMOCK-COND-001",
    requestedCodeType: "kj",
    quantity: 10,
    customerNote: "客户要中性包装",
    tradeMode: "export_usd",
    sourceMode: "mock",
    previewStatus: "ready_for_draft_preview",
    kjCode: "KJMOCK-COND-001",
    productNameCandidate: "Mock condenser",
    category: "冷凝器",
    priceCandidateStatus: "not_finance_approved",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    warnings: ["非财务批准价格，仅草稿候选，不是正式报价。"],
    ...overrides
  };
}

describe("Quote Task 008F export quote draft Excel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the Excel export feature flag closed unless explicitly enabled", () => {
    vi.stubEnv("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL", "");
    expect(isExportQuoteDraftExcelEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL", "false");
    expect(isExportQuoteDraftExcelEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL", "true");
    expect(isExportQuoteDraftExcelEnabled()).toBe(true);
  });

  it("builds workbook rows with draft notices and preview data", () => {
    const lines = [
      makeLine(),
      makeLine({
        lineNo: 2,
        rawInput: "KJMOCK-NOT-FOUND",
        requestedCode: "KJMOCK-NOT-FOUND",
        quantity: undefined,
        previewStatus: "missing_quantity",
        kjCode: undefined,
        productNameCandidate: undefined,
        category: undefined,
        priceCandidateStatus: undefined,
        hasCostCandidate: false,
        warnings: ["缺少数量，请人工确认。"]
      })
    ];
    const rows = buildExportQuoteDraftWorkbookRows(lines, summarizeExportQuoteDraftPreviewLines(lines));
    const serialized = JSON.stringify(rows);

    expect(serialized).toContain("KingaOS 询价 / 报价草稿");
    expect(serialized).toContain("非正式报价，仅供内部整理使用。");
    expect(serialized).toContain("价格候选不是财务批准价格，不能直接发客户。");
    expect(serialized).toContain("行号");
    expect(serialized).toContain("原始输入");
    expect(serialized).toContain("KJMOCK-COND-001");
    expect(serialized).toContain("10");
    expect(serialized).toContain("可生成草稿预览");
    expect(serialized).toContain("缺少数量，请补充数量。");
    expect(serialized).toContain("非财务批准价格，仅草稿候选");
  });

  it("does not emit sensitive price or formal quote fields", () => {
    const lines = [makeLine()];
    const rows = buildExportQuoteDraftWorkbookRows(lines, summarizeExportQuoteDraftPreviewLines(lines));
    const serialized = JSON.stringify(rows);

    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("unitPrice");
    expect(serialized).not.toContain("grossMargin");
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("uses a non-formal draft filename", () => {
    const fileName = buildExportQuoteDraftExcelFileName(new Date("2026-05-14T09:30:00+08:00"));

    expect(fileName).toContain("草稿");
    expect(fileName).toMatch(/^KingaOS-询价报价草稿-\d{8}-\d{4}\.xlsx$/);
    expect(fileName).not.toContain("正式报价单");
    expect(fileName).not.toContain("Official Quote");
    expect(fileName).not.toContain("Sales Quote");
  });
});
