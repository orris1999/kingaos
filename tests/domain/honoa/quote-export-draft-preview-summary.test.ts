import { describe, expect, it } from "vitest";
import {
  summarizeExportQuoteDraftPreviewLines,
  type ExportQuoteDraftPreviewLine
} from "@/lib/honoa/quote-draft";

function makeLine(overrides: Partial<ExportQuoteDraftPreviewLine> = {}): ExportQuoteDraftPreviewLine {
  return {
    lineNo: 1,
    rawInput: "KJMOCK-COND-001 10",
    requestedCode: "KJMOCK-COND-001",
    requestedCodeType: "kj",
    quantity: 10,
    tradeMode: "export_usd",
    sourceMode: "mock",
    previewStatus: "ready_for_draft_preview",
    warnings: [],
    ...overrides
  };
}

describe("Quote Task 008E export quote draft preview summary", () => {
  it("counts total and ready preview lines", () => {
    const summary = summarizeExportQuoteDraftPreviewLines([
      makeLine({ previewStatus: "ready_for_draft_preview" }),
      makeLine({ previewStatus: "ready_for_draft_preview" }),
      makeLine({ previewStatus: "not_found" })
    ]);

    expect(summary.total).toBe(3);
    expect(summary.ready).toBe(2);
  });

  it("counts exception preview statuses", () => {
    const summary = summarizeExportQuoteDraftPreviewLines([
      makeLine({ previewStatus: "not_found" }),
      makeLine({ previewStatus: "multiple_candidates" }),
      makeLine({ previewStatus: "manual_review_required" }),
      makeLine({ previewStatus: "missing_quantity" }),
      makeLine({ previewStatus: "unsupported_oem", requestedCodeType: "oem" }),
      makeLine({ previewStatus: "ready_for_draft_preview", priceCandidateStatus: "not_finance_approved" })
    ]);

    expect(summary.notFound).toBe(1);
    expect(summary.multipleCandidates).toBe(1);
    expect(summary.manualReview).toBe(1);
    expect(summary.missingQuantity).toBe(1);
    expect(summary.unsupportedOem).toBe(1);
    expect(summary.notFinanceApproved).toBe(1);
  });

  it("builds Chinese action items for business follow-up", () => {
    const summary = summarizeExportQuoteDraftPreviewLines([
      makeLine({ previewStatus: "not_found" }),
      makeLine({ previewStatus: "multiple_candidates" }),
      makeLine({ previewStatus: "missing_quantity" }),
      makeLine({ previewStatus: "unsupported_oem", requestedCodeType: "oem" }),
      makeLine({ previewStatus: "ready_for_draft_preview", priceCandidateStatus: "not_finance_approved" })
    ]);
    const messages = summary.actionItems.map((item) => item.message).join("\n");

    expect(messages).toContain("有 1 行缺少数量，请补充数量。");
    expect(messages).toContain("有 1 行未找到财务确认 staging 候选，请核对 KJ 或联系财务 / 技术。");
    expect(messages).toContain("有 1 行多候选，需要选择正确 KJ。");
    expect(messages).toContain("有 1 行 OEM 暂未开放，请先通过技术确认找到 KJ。");
    expect(messages).toContain("有 1 行价格候选不是财务批准价格，不能直接发客户。");
  });

  it("does not create action items for a clean preview", () => {
    const summary = summarizeExportQuoteDraftPreviewLines([
      makeLine({ previewStatus: "ready_for_draft_preview" })
    ]);

    expect(summary.actionItems).toEqual([]);
  });
});
