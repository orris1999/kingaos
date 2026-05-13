import { describe, expect, it } from "vitest";
import {
  generateV1QuoteDraftCandidates,
  getDeferredQuoteV1Capabilities,
  getQuoteV1SourceReadiness,
  isQuoteAddonOnlyCategory,
  isV1AutoEligibleQuoteCategory,
  isV1EligibleWithConditionsQuoteCategory,
  parseQuoteDraftInput,
  requiresV1ManualConfirmation
} from "@/lib/honoa/quote-draft";
import type { QuoteDraftCatalogItem } from "@/lib/honoa/quote-draft";

const v1Catalog: QuoteDraftCatalogItem[] = [
  {
    kjCode: "KJCOND001",
    productName: "Mock Condenser",
    category: "冷凝器",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 1 }
  },
  {
    kjCode: "KJRAD-STD-001",
    productName: "Mock Radiator Standard",
    category: "水箱",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 2 }
  },
  {
    kjCode: "KJRAD-BASE-001",
    productName: "Mock Radiator Base A",
    category: "水箱",
    imageStatus: "available"
  },
  {
    kjCode: "KJRAD-BASE-001",
    productName: "Mock Radiator Base B",
    category: "水箱",
    imageStatus: "available"
  },
  {
    kjCode: "KJIC-STD-001",
    productName: "Mock Intercooler Standard",
    category: "中冷器",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 3 }
  },
  {
    kjCode: "KJIC-OLD-001",
    rawKjCode: "旧 KJ.NO: KJIC-OLD-001",
    sourceCodeType: "old_code",
    productName: "Mock Intercooler Old Code",
    category: "中冷器",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 4 }
  },
  {
    kjCode: "KJIC-FUMA-001",
    rawKjCode: "孚盟编码: KJIC-FUMA-001",
    sourceCodeType: "fumacrm_code",
    productName: "Mock Intercooler Fuma",
    category: "中冷器",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 5 }
  },
  {
    kjCode: "KJRAD-ERP-001",
    rawKjCode: "鼎捷编码: KJRAD-ERP-001",
    sourceCodeType: "erp_code",
    productName: "Mock Radiator ERP",
    category: "水箱",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 6 }
  },
  {
    kjCode: "KJPACK001",
    productName: "Mock Packaging",
    category: "特殊包装及其他",
    imageStatus: "missing",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 7 }
  },
  {
    kjCode: "KJUNKNOWN001",
    productName: "Mock Unknown",
    category: "未知品类",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 8 }
  }
];

describe("Quote Task 004B-R V1 KJ 报价草稿 source readiness 行级规则", () => {
  it.each(["冷凝器", "暖风", "蒸发器", "水室", "全铝自产机冷"])("%s 是 v1_auto_eligible", (category) => {
    const readiness = getQuoteV1SourceReadiness(category);

    expect(readiness.readiness).toBe("v1_auto_eligible");
    expect(readiness.allowedForV1ProductDraft).toBe(true);
    expect(readiness.requiresManualConfirmation).toBe(false);
    expect(isV1AutoEligibleQuoteCategory(category)).toBe(true);
  });

  it("水箱 category readiness = v1_eligible_with_conditions", () => {
    const readiness = getQuoteV1SourceReadiness("水箱");

    expect(readiness.readiness).toBe("v1_eligible_with_conditions");
    expect(readiness.allowedForV1ProductDraft).toBe(true);
    expect(readiness.requiresManualConfirmation).toBe(false);
    expect(readiness.reasons).toContain("water_tank_manual_confirmation");
    expect(isV1EligibleWithConditionsQuoteCategory("水箱")).toBe(true);
    expect(requiresV1ManualConfirmation("水箱")).toBe(false);
  });

  it("中冷器 category readiness = v1_eligible_with_conditions", () => {
    const readiness = getQuoteV1SourceReadiness("中冷器");

    expect(readiness.readiness).toBe("v1_eligible_with_conditions");
    expect(readiness.allowedForV1ProductDraft).toBe(true);
    expect(readiness.requiresManualConfirmation).toBe(false);
    expect(readiness.reasons).toContain("intercooler_manual_confirmation");
    expect(isV1EligibleWithConditionsQuoteCategory("中冷器")).toBe(true);
  });

  it("水箱完整标准 KJ mock 唯一匹配可进入 V1 草稿", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJRAD-STD-001 10"), v1Catalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1Readiness).toBe("v1_eligible_with_conditions");
    expect(candidate.v1ReadinessLabel).toBe("可进入 V1 草稿");
    expect(candidate.requiresManualConfirmation).toBe(false);
    expect(candidate.v1LineRisks).toEqual([]);
  });

  it("中冷器完整标准 KJ mock 唯一匹配可进入 V1 草稿", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJIC-STD-001 10"), v1Catalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1Readiness).toBe("v1_eligible_with_conditions");
    expect(candidate.v1ReadinessLabel).toBe("可进入 V1 草稿");
    expect(candidate.requiresManualConfirmation).toBe(false);
  });

  it("水箱基础 KJ 多候选触发人工确认", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJRAD-BASE-001 10"), v1Catalog);

    expect(candidate.matchStatus).toBe("ambiguous_kj");
    expect(candidate.v1Readiness).toBe("v1_eligible_with_conditions");
    expect(candidate.v1ReadinessLabel).toBe("需人工确认");
    expect(candidate.requiresManualConfirmation).toBe(true);
    expect(candidate.v1LineRisks).toEqual(expect.arrayContaining(["base_kj_multi_candidate", "multiple_candidates"]));
  });

  it("中冷器旧 KJ.NO 匹配触发人工确认", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJIC-OLD-001 10"), v1Catalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1ReadinessLabel).toBe("需人工确认");
    expect(candidate.requiresManualConfirmation).toBe(true);
    expect(candidate.v1LineRisks).toContain("old_kj_code_match");
  });

  it("孚盟码和鼎捷码匹配触发人工确认", () => {
    const [fumaCandidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJIC-FUMA-001 10"), v1Catalog);
    const [erpCandidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJRAD-ERP-001 10"), v1Catalog);

    expect(fumaCandidate.v1LineRisks).toContain("fumacrm_code_match");
    expect(fumaCandidate.requiresManualConfirmation).toBe(true);
    expect(erpCandidate.v1LineRisks).toContain("dingjie_code_match");
    expect(erpCandidate.requiresManualConfirmation).toBe(true);
  });

  it("OEM 输入仍然暂缓 / oem_not_supported_yet", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("16400-XXXXX 300"), v1Catalog);

    expect(candidate.matchStatus).toBe("oem_not_supported_yet");
    expect(candidate.v1Readiness).toBe("deferred");
    expect(candidate.v1ReadinessLabel).toBe("暂缓");
    expect(candidate.v1LineRisks).toContain("oem_input_not_supported");
  });

  it("特殊包装及其他仍为仅附加项候选", () => {
    const readiness = getQuoteV1SourceReadiness("特殊包装及其他");
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJPACK001 10"), v1Catalog);

    expect(readiness.readiness).toBe("addon_only");
    expect(readiness.allowedAsAddonOnly).toBe(true);
    expect(candidate.v1Readiness).toBe("addon_only");
    expect(candidate.v1ReadinessLabel).toBe("仅附加项候选");
    expect(candidate.isAddonOnly).toBe(true);
    expect(isQuoteAddonOnlyCategory("特殊包装及其他")).toBe(true);
  });

  it("未知品类匹配后转为 requires_technical_review", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJUNKNOWN001 1"), v1Catalog);

    expect(candidate.matchStatus).toBe("requires_technical_review");
    expect(candidate.v1Readiness).toBe("deferred");
    expect(candidate.v1ReadinessLabel).toBe("暂缓");
  });

  it("v1_auto_eligible 行仍提示价格候选不是财务批准价格", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJCOND001 10"), v1Catalog);

    expect(candidate.v1Readiness).toBe("v1_auto_eligible");
    expect(candidate.priceStatus).toBe("not_finance_approved");
    expect(candidate.warnings.join("\n")).toContain("价格候选不是财务批准价格");
  });

  it("deferred 能力包含 OEM、正式报价、价格审批和 Excel 图片主图", () => {
    expect(getDeferredQuoteV1Capabilities()).toEqual(
      expect.arrayContaining(["OEM 自动匹配", "正式报价", "价格审批", "Excel 嵌入图片作为稳定主图"])
    );
  });

  it("输出 DTO 不包含正式报价或财务批准价字段", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJCOND001 10"), v1Catalog);
    const serialized = JSON.stringify(candidate);

    expect(serialized).not.toContain("finance" + "Approved" + "Price");
    expect(serialized).not.toContain("official" + "Quote");
    expect(serialized).not.toContain("sent" + "To" + "Customer");
    expect(serialized).not.toContain(["sent", "to", "customer"].join("_"));
  });

  it("V1 readiness 规则不需要数据库即可运行", () => {
    const lines = parseQuoteDraftInput(["KJCOND001 1", "KJRAD-STD-001 2", "KJPACK001 3"].join("\n"));
    const candidates = generateV1QuoteDraftCandidates(lines, v1Catalog);

    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.v1Readiness)).toEqual([
      "v1_auto_eligible",
      "v1_eligible_with_conditions",
      "addon_only"
    ]);
  });
});
