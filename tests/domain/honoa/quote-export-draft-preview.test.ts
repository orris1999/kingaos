import { describe, expect, it } from "vitest";
import {
  buildExportQuoteDraftPreviewLines,
  type ExportQuoteDraftSourceCandidate
} from "@/lib/honoa/quote-draft";

function makeStagingCandidate(overrides: Partial<ExportQuoteDraftSourceCandidate> = {}): ExportQuoteDraftSourceCandidate {
  return {
    source: "finance_confirmed_staging",
    stagingBatchId: "batch-preview-test",
    stagingRowId: "row-preview-test",
    standardKjCode: "KJMOCK-COND-001",
    productNameCandidate: "Mock condenser",
    category: "冷凝器",
    tradeMode: "export_usd",
    priceCandidateStatus: "not_finance_approved",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: false,
    hasOemInfo: false,
    warnings: ["价格候选不是财务批准价格。"],
    ...overrides
  };
}

describe("Quote Task 008D export quote draft preview builder", () => {
  it("parses KJ, quantity, customer note, and export trade mode", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001, 50, 客户要中性包装",
      tradeMode: "export_usd",
      sourceMode: "mock"
    });

    expect(line.requestedCode).toBe("KJMOCK-COND-001");
    expect(line.quantity).toBe(50);
    expect(line.customerNote).toBe("客户要中性包装");
    expect(line.tradeMode).toBe("export_usd");
    expect(line.previewStatus).toBe("ready_for_draft_preview");
  });

  it("supports common quantity separators and domestic trade mode", () => {
    const lines = buildExportQuoteDraftPreviewLines({
      inputText: [
        "KJMOCK-COND-001 100pcs",
        "KJMOCK-COND-001 100 pcs",
        "KJMOCK-COND-001*100",
        "KJMOCK-COND-001 x 100",
        "KJMOCK-COND-001，100"
      ].join("\n"),
      tradeMode: "domestic_cny",
      sourceMode: "mock"
    });

    expect(lines).toHaveLength(5);
    expect(lines.every((line) => line.quantity === 100)).toBe(true);
    expect(lines.every((line) => line.tradeMode === "domestic_cny")).toBe(true);
  });

  it("keeps a preview line and warning when quantity is missing", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001",
      tradeMode: "unknown",
      sourceMode: "mock"
    });

    expect(line.previewStatus).toBe("missing_quantity");
    expect(line.warnings.join(" ")).toContain("缺少数量");
  });

  it("marks OEM input as unsupported", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "16400-XXXXX 20",
      tradeMode: "unknown",
      sourceMode: "mock"
    });

    expect(line.previewStatus).toBe("unsupported_oem");
    expect(line.warnings.join(" ")).toContain("OEM");
  });

  it("marks staging no-result lines as not_found", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-NOT-FOUND 10",
      tradeMode: "export_usd",
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: true,
      stagingCandidatesByLine: {}
    });

    expect(line.previewStatus).toBe("not_found");
    expect(line.warnings.join(" ")).toContain("未找到财务确认的 staging 候选");
  });

  it("marks staging source as disabled when the feature flag is closed", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001 10",
      tradeMode: "export_usd",
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: false,
      stagingCandidatesByLine: {
        1: [makeStagingCandidate()]
      }
    });

    expect(line.previewStatus).toBe("staging_disabled");
    expect(line.warnings.join(" ")).toContain("staging 数据源未开放");
  });

  it("marks multiple staging candidates without auto-selecting the first row", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001 10",
      tradeMode: "export_usd",
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: true,
      stagingCandidatesByLine: {
        1: [
          makeStagingCandidate({ stagingRowId: "row-a", productNameCandidate: "Candidate A" }),
          makeStagingCandidate({ stagingRowId: "row-b", productNameCandidate: "Candidate B" })
        ]
      }
    });

    expect(line.previewStatus).toBe("multiple_candidates");
    expect(line.productNameCandidate).toBeUndefined();
    expect(line.warnings.join(" ")).toContain("不能自动取第一行");
  });

  it("keeps not_finance_approved as draft preview only with explicit warning", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001 10",
      tradeMode: "export_usd",
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: true,
      stagingCandidatesByLine: {
        1: [makeStagingCandidate()]
      }
    });

    expect(line.previewStatus).toBe("ready_for_draft_preview");
    expect(line.priceCandidateStatus).toBe("not_finance_approved");
    expect(line.warnings.join(" ")).toContain("非财务批准价格");
    expect(line.warnings.join(" ")).toContain("不是正式报价");
  });

  it("preserves radiator and intercooler manual confirmation warnings", () => {
    const [line] = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-RAD-PA16-A 10",
      tradeMode: "export_usd",
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: true,
      stagingCandidatesByLine: {
        1: [
          makeStagingCandidate({
            standardKjCode: "KJMOCK-RAD-PA16-A",
            category: "水箱",
            warnings: ["水箱 / 中冷器存在多编码、多规格、多包装字段，生成草稿前请确认。"]
          })
        ]
      }
    });

    expect(line.previewStatus).toBe("ready_for_draft_preview");
    expect(line.category).toBe("水箱");
    expect(line.warnings.join(" ")).toContain("多编码");
    expect(line.warnings.join(" ")).toContain("多规格");
    expect(line.warnings.join(" ")).toContain("多包装");
  });

  it("does not output sensitive price or official quote fields", () => {
    const lines = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001 10",
      tradeMode: "export_usd",
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: true,
      stagingCandidatesByLine: {
        1: [makeStagingCandidate()]
      }
    });
    const serialized = JSON.stringify(lines);

    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("grossMargin");
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });
});
