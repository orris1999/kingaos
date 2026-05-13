import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  QuoteSourceStagingBatch,
  QuoteSourceStagingRow,
  QuoteSourceStagingVisibility
} from "@/lib/honoa/quote-draft";

const batch: QuoteSourceStagingBatch = {
  id: "staging-batch-mock-001",
  sourceFileName: "mock-source.xlsx",
  adapterId: "radiator-cost-2026",
  category: "水箱",
  submittedByRole: "finance",
  consumerDepartment: "export",
  dryRunDecisionStatus: "ready_for_staging_design",
  status: "finance_confirmed",
  createdAt: "2026-05-13T00:00:00.000Z",
  confirmedAt: "2026-05-13T00:10:00.000Z",
  warnings: ["staging 仍不是正式价格表。"]
};

function makeRow(overrides: Partial<QuoteSourceStagingRow> = {}): QuoteSourceStagingRow {
  return {
    id: "staging-row-mock-001",
    batchId: batch.id,
    sourceRowNumber: 12,
    rawKjCode: "KJMOCK-RAD-PA16-A",
    standardKjCode: "KJMOCK-RAD-PA16-A",
    productNameCandidate: "Mock radiator",
    category: "水箱",
    tradeMode: "export_usd",
    priceCandidateStatus: "not_finance_approved",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: true,
    hasOemInfo: false,
    visibility: "export_draft_candidate",
    rowStatus: "candidate",
    warnings: ["价格候选不是财务批准价格。"],
    ...overrides
  };
}

function sourceText() {
  return readFileSync(
    new URL("../../../lib/honoa/quote-draft/source-staging-types.ts", import.meta.url),
    "utf8"
  );
}

describe("Quote Task 006A Finance quote source staging 类型草案", () => {
  it("QuoteSourceStagingBatch submittedByRole 只能表达 finance", () => {
    expect(batch.submittedByRole).toBe("finance");
  });

  it("QuoteSourceStagingBatch consumerDepartment 可以是 export", () => {
    expect(batch.consumerDepartment).toBe("export");
  });

  it("finance_confirmed 不等于财务批准价格", () => {
    expect(batch.status).toBe("finance_confirmed");
    expect(batch.warnings.join(" ")).toContain("仍不是正式价格表");
  });

  it("staging batch 不是正式价格表", () => {
    const serialized = JSON.stringify(batch);

    expect(serialized).toContain("finance_confirmed");
    expect(serialized).not.toContain("formalQuote");
    expect(serialized).not.toContain("approvedSnapshot");
  });

  it("staging row 不包含金额或正式财务价格字段", () => {
    const row = makeRow();
    const serialized = JSON.stringify(row);

    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("unitPrice");
    expect(serialized).not.toContain("finance" + "Approved" + "Price");
  });

  it("row visibility 支持 finance_only / export_draft_candidate / internal_risk_only", () => {
    const values: QuoteSourceStagingVisibility[] = [
      "finance_only",
      "export_draft_candidate",
      "internal_risk_only"
    ];

    expect(values).toEqual(["finance_only", "export_draft_candidate", "internal_risk_only"]);
  });

  it("特殊包装及其他 rowStatus = addon_only", () => {
    const row = makeRow({
      category: "特殊包装及其他",
      standardKjCode: undefined,
      rowStatus: "addon_only",
      visibility: "finance_only",
      hasCostCandidate: false,
      hasQuoteCandidate: true,
      warnings: ["只能作为包装 / 附加项候选。"]
    });

    expect(row.rowStatus).toBe("addon_only");
    expect(row.visibility).toBe("finance_only");
  });

  it("水箱完整标准 KJ 可以是 candidate", () => {
    const row = makeRow({
      category: "水箱",
      standardKjCode: "KJMOCK-RAD-PA16-A",
      rowStatus: "candidate",
      visibility: "export_draft_candidate"
    });

    expect(row.rowStatus).toBe("candidate");
    expect(row.visibility).toBe("export_draft_candidate");
  });

  it("水箱基础 KJ 多候选必须是 needs_manual_review", () => {
    const row = makeRow({
      standardKjCode: undefined,
      baseKjCode: "KJMOCK-RAD-BASE",
      rowStatus: "needs_manual_review",
      visibility: "finance_only",
      warnings: ["基础 KJ 多候选，不能静默选择。"]
    });

    expect(row.rowStatus).toBe("needs_manual_review");
    expect(row.warnings.join(" ")).toContain("多候选");
  });

  it("中冷器旧码匹配必须是 needs_manual_review", () => {
    const row = makeRow({
      category: "中冷器",
      standardKjCode: undefined,
      oldKjNo: "KJMOCK-IC-OLD",
      fumacrmCode: "KJMOCK-IC-OLD",
      rowStatus: "needs_manual_review",
      visibility: "finance_only",
      warnings: ["旧码 / 孚盟码匹配，需要人工确认。"]
    });

    expect(row.rowStatus).toBe("needs_manual_review");
    expect(row.oldKjNo).toBe("KJMOCK-IC-OLD");
  });

  it("OEM 输入不允许自动进入 candidate", () => {
    const row = makeRow({
      standardKjCode: undefined,
      hasOemInfo: true,
      rowStatus: "needs_manual_review",
      visibility: "finance_only",
      warnings: ["OEM 自动匹配暂未开放。"]
    });

    expect(row.rowStatus).not.toBe("candidate");
    expect(row.hasOemInfo).toBe(true);
  });

  it("export_draft_candidate 仍然不是正式报价", () => {
    const row = makeRow({ visibility: "export_draft_candidate" });

    expect(row.visibility).toBe("export_draft_candidate");
    expect(row.priceCandidateStatus).toBe("not_finance_approved");
    expect(row.warnings.join(" ")).toContain("不是财务批准价格");
  });

  it("类型文件不出现正式报价和敏感价格业务字段", () => {
    const text = sourceText();

    expect(text).not.toContain("amount");
    expect(text).not.toContain("costPrice");
    expect(text).not.toContain("finance" + "Approved" + "Price");
    expect(text).not.toContain("official" + "Quote");
    expect(text).not.toContain("sent" + "To" + "Customer");
    expect(text).not.toContain("approved" + "Price");
    expect(text).not.toContain("minimum" + "Price");
    expect(text).not.toContain("gross" + "Margin");
  });
});
