import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  precheckQuoteSourceStagingRowImport,
  type QuoteSourceRowImportPrecheckInput
} from "@/lib/honoa/quote-draft/source-staging-row-import-precheck";

const root = process.cwd();

function makeInput(overrides: Partial<QuoteSourceRowImportPrecheckInput> = {}): QuoteSourceRowImportPrecheckInput {
  return {
    batchId: "batch-001",
    adapterId: "condenser-cost-2026",
    category: "冷凝器",
    status: "dry_run_passed",
    dryRunDecisionStatus: "ready_for_staging_design",
    rowCount: 0,
    uploadDryRunWarnings: [],
    ...overrides
  };
}

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Quote Task 009G row import precheck", () => {
  it("allows row import design for dry_run_passed + ready_for_staging_design with adapter/category", () => {
    const result = precheckQuoteSourceStagingRowImport(makeInput());

    expect(result.status).toBe("ready_for_row_import_design");
    expect(result.canDesignRowImport).toBe(true);
    expect(result.canImportRowsNow).toBe(false);
  });

  it("treats manual_review_required as review-needed but still designable", () => {
    const result = precheckQuoteSourceStagingRowImport(
      makeInput({
        dryRunDecisionStatus: "manual_review_required",
        uploadDryRunWarnings: ["存在人工确认提示。"]
      })
    );

    expect(result.status).toBe("needs_finance_review");
    expect(result.canDesignRowImport).toBe(true);
    expect(result.canImportRowsNow).toBe(false);
    expect(result.reasons.join(" ")).toContain("manual_review_required 不代表失败");
    expect(result.nextActions.join(" ")).toContain("确认 adapter 是否正确");
  });

  it("blocks missing adapterId", () => {
    const result = precheckQuoteSourceStagingRowImport(makeInput({ adapterId: "" }));

    expect(result.status).toBe("blocked");
    expect(result.canDesignRowImport).toBe(false);
    expect(result.reasons.join(" ")).toContain("缺少 adapterId");
  });

  it("blocks missing category", () => {
    const result = precheckQuoteSourceStagingRowImport(makeInput({ category: "" }));

    expect(result.status).toBe("blocked");
    expect(result.canDesignRowImport).toBe(false);
    expect(result.reasons.join(" ")).toContain("缺少 category");
  });

  it("blocks cancelled batch", () => {
    const result = precheckQuoteSourceStagingRowImport(makeInput({ status: "cancelled" }));

    expect(result.status).toBe("blocked");
    expect(result.canDesignRowImport).toBe(false);
    expect(result.reasons.join(" ")).toContain("batch status 必须是 dry_run_passed");
  });

  it("warns when rows already exist", () => {
    const result = precheckQuoteSourceStagingRowImport(makeInput({ rowCount: 3 }));

    expect(result.status).toBe("blocked");
    expect(result.reasons.join(" ")).toContain("已有 staging rows");
    expect(result.nextActions.join(" ")).toContain("避免重复导入");
  });

  it("never allows row import now", () => {
    const cases = [
      makeInput(),
      makeInput({ dryRunDecisionStatus: "manual_review_required" }),
      makeInput({ adapterId: "" }),
      makeInput({ status: "cancelled" })
    ];

    for (const input of cases) {
      expect(precheckQuoteSourceStagingRowImport(input).canImportRowsNow).toBe(false);
    }
  });

  it("does not create rows or expose price field names", () => {
    const source = readRepoFile("lib/honoa/quote-draft/source-staging-row-import-precheck.ts");

    expect(source).not.toContain("QuoteSourceStagingRow.create");
    expect(source).not.toContain("prisma");
    expect(source).not.toContain("cost" + "Price");
    expect(source).not.toContain("unit" + "Price");
    expect(source).not.toContain("gross" + "Margin");
  });

  it("staging detail page explains metadata-only and rowCount=0 boundary", () => {
    const detail = readRepoFile("components/finance-quote-source-staging-detail.tsx");

    expect(detail).toContain("当前只有 staging batch metadata");
    expect(detail).toContain("尚未导入行级候选数据。请先完成行级导入前检查。");
    expect(detail).toContain("当前不能生成报价草稿");
    expect(detail).toContain("当前不能生成正式报价");
    expect(detail).toContain("manual_review_required 需要人工确认，不是失败");
    expect(detail).not.toContain("cost" + "Price");
    expect(detail).not.toContain("unit" + "Price");
    expect(detail).not.toContain("gross" + "Margin");
  });
});
