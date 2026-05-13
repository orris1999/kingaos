import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decideQuoteSourceDryRunNextStep,
  type QuoteSourceDryRunDecisionInput
} from "@/lib/honoa/quote-draft";

const baseInput: QuoteSourceDryRunDecisionInput = {
  adapterId: "condenser-cost-2026",
  category: "冷凝器",
  confidence: "high",
  hasKjColumn: true,
  hasOemColumn: false,
  hasProductNameColumn: true,
  hasCostCandidateColumn: true,
  hasQuoteCandidateColumn: false,
  hasPackagingColumn: true,
  warnings: [],
  unsupportedReasons: []
};

function decide(overrides: Partial<QuoteSourceDryRunDecisionInput> = {}) {
  return decideQuoteSourceDryRunNextStep({ ...baseInput, ...overrides });
}

function sourceText() {
  return readFileSync(
    new URL("../../../lib/honoa/quote-draft/source-dry-run-decision.ts", import.meta.url),
    "utf8"
  );
}

describe("Quote Task 005C Finance dry-run 结果确认决策", () => {
  it("high confidence + KJ + 产品名 + 成本候选可进入 staging 设计", () => {
    const result = decide();

    expect(result.status).toBe("ready_for_staging_design");
    expect(result.canProceedToStagingDesign).toBe(true);
    expect(result.requiresFinanceConfirmation).toBe(true);
    expect(result.canBeUsedByExportDraft).toBe(false);
    expect(result.reasons.join(" ")).toContain("不是财务批准价格");
  });

  it("缺 KJ 时要求财务修表", () => {
    const result = decide({ hasKjColumn: false });

    expect(result.status).toBe("needs_finance_table_fix");
    expect(result.canProceedToStagingDesign).toBe(false);
    expect(result.requiresFinanceConfirmation).toBe(true);
    expect(result.nextActions.join(" ")).toContain("补充或确认 KJ");
  });

  it("缺产品名称时要求财务修表", () => {
    const result = decide({ hasProductNameColumn: false });

    expect(result.status).toBe("needs_finance_table_fix");
    expect(result.nextActions.join(" ")).toContain("产品名称");
  });

  it("缺价格候选列时要求财务修表", () => {
    const result = decide({ hasCostCandidateColumn: false, hasQuoteCandidateColumn: false });

    expect(result.status).toBe("needs_finance_table_fix");
    expect(result.nextActions.join(" ")).toContain("成本候选列");
  });

  it("medium confidence 但字段齐全时要求修 adapter", () => {
    const result = decide({ confidence: "medium" });

    expect(result.status).toBe("needs_adapter_fix");
    expect(result.requiresAdapterUpdate).toBe(true);
    expect(result.nextActions.join(" ")).toContain("fileNamePattern");
  });

  it("low confidence 但字段齐全时要求修 adapter", () => {
    const result = decide({ confidence: "low" });

    expect(result.status).toBe("needs_adapter_fix");
    expect(result.requiresAdapterUpdate).toBe(true);
    expect(result.nextActions.join(" ")).toContain("sheetNameHint");
  });

  it("特殊包装及其他只能作为 addon_only", () => {
    const result = decide({
      adapterId: "special-packaging-cost-2026",
      category: "特殊包装及其他",
      hasKjColumn: false,
      hasCostCandidateColumn: false,
      hasQuoteCandidateColumn: true
    });

    expect(result.status).toBe("addon_only");
    expect(result.canProceedToStagingDesign).toBe(false);
    expect(result.canBeUsedByExportDraft).toBe(false);
    expect(result.reasons.join(" ")).toContain("附加项候选");
  });

  it("水箱字段齐全时可进入 staging 设计但需要财务确认", () => {
    const result = decide({
      adapterId: "radiator-cost-2026",
      category: "水箱",
      hasOemColumn: true
    });

    expect(result.status).toBe("ready_for_staging_design");
    expect(result.canProceedToStagingDesign).toBe(true);
    expect(result.requiresFinanceConfirmation).toBe(true);
    expect(result.reasons.join(" ")).toContain("行级人工确认");
  });

  it("中冷器字段齐全时可进入 staging 设计但需要财务确认", () => {
    const result = decide({
      adapterId: "intercooler-cost-2026",
      category: "中冷器",
      hasOemColumn: true
    });

    expect(result.status).toBe("ready_for_staging_design");
    expect(result.canProceedToStagingDesign).toBe(true);
    expect(result.requiresFinanceConfirmation).toBe(true);
    expect(result.reasons.join(" ")).toContain("行级人工确认");
  });

  it("所有决策都不能直接给出口部消费", () => {
    const cases: Partial<QuoteSourceDryRunDecisionInput>[] = [
      {},
      { hasKjColumn: false },
      { confidence: "medium" },
      { adapterId: "special-packaging-cost-2026", category: "特殊包装及其他", hasKjColumn: false },
      { confidence: "none", unsupportedReasons: ["未匹配到报价表 adapter。"] },
      { warnings: ["存在风险，需要人工确认。"] }
    ];

    for (const overrides of cases) {
      expect(decide(overrides).canBeUsedByExportDraft).toBe(false);
    }
  });

  it("完全不匹配或阻断 unsupported reason 时 blocked", () => {
    const result = decide({
      confidence: "none",
      unsupportedReasons: ["未匹配到报价表 adapter。"]
    });

    expect(result.status).toBe("blocked");
    expect(result.canProceedToStagingDesign).toBe(false);
  });

  it("高置信度但存在风险信号时进入 manual_review_required", () => {
    const result = decide({
      warnings: ["存在风险字段，需要人工确认。"]
    });

    expect(result.status).toBe("manual_review_required");
    expect(result.requiresFinanceConfirmation).toBe(true);
    expect(result.canProceedToStagingDesign).toBe(false);
  });

  it("决策结果不包含真实价格字段", () => {
    const text = JSON.stringify(decide());

    expect(text).not.toContain("amount");
    expect(text).not.toContain("costPriceValue");
    expect(text).not.toContain("quotePriceValue");
  });

  it("代码业务字段不引入正式报价误导字段", () => {
    const text = sourceText();

    expect(text).not.toContain("finance" + "Approved" + "Price");
    expect(text).not.toContain("official" + "Quote");
    expect(text).not.toContain("sent" + "To" + "Customer");
  });
});
