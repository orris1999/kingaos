import { describe, expect, it } from "vitest";
import {
  generateV1QuoteDraftCandidates,
  getDeferredQuoteV1Capabilities,
  getQuoteV1SourceReadiness,
  isQuoteAddonOnlyCategory,
  isV1AutoEligibleQuoteCategory,
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
    kjCode: "KJHEAT001",
    productName: "Mock Heater",
    category: "暖风",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 2 }
  },
  {
    kjCode: "KJEVAP001",
    productName: "Mock Evaporator",
    category: "蒸发器",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 3 }
  },
  {
    kjCode: "KJCHAMBER001",
    productName: "Mock Water Chamber",
    category: "水室",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 4 }
  },
  {
    kjCode: "KJALINT001",
    productName: "Mock Aluminum Intercooler",
    category: "全铝自产机冷",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 5 }
  },
  {
    kjCode: "KJRAD001",
    productName: "Mock Radiator",
    category: "水箱",
    imageStatus: "embedded_only",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 6 }
  },
  {
    kjCode: "KJINT001",
    productName: "Mock Intercooler",
    category: "中冷器",
    imageStatus: "embedded_only",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 7 }
  },
  {
    kjCode: "KJPACK001",
    productName: "Mock Packaging",
    category: "特殊包装及其他",
    imageStatus: "missing",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 8 }
  },
  {
    kjCode: "KJUNKNOWN001",
    productName: "Mock Unknown",
    category: "未知品类",
    imageStatus: "available",
    priceCandidate: { sourceType: "cost_candidate", sourceFile: "mock", sourceSheet: "mock", sourceRow: 9 }
  },
  {
    kjCode: "KJBASE001",
    productName: "Mock Radiator A",
    category: "水箱",
    imageStatus: "available"
  },
  {
    kjCode: "KJBASE001",
    productName: "Mock Radiator B",
    category: "水箱",
    imageStatus: "available"
  }
];

describe("Quote Task 004A V1 KJ 报价草稿 source readiness gate", () => {
  it.each(["冷凝器", "暖风", "蒸发器", "水室", "全铝自产机冷"])("%s 是 v1_auto_eligible", (category) => {
    const readiness = getQuoteV1SourceReadiness(category);

    expect(readiness.readiness).toBe("v1_auto_eligible");
    expect(readiness.allowedForV1ProductDraft).toBe(true);
    expect(readiness.requiresManualConfirmation).toBe(false);
    expect(isV1AutoEligibleQuoteCategory(category)).toBe(true);
  });

  it("水箱是 v1_manual_confirmation_required", () => {
    const readiness = getQuoteV1SourceReadiness("水箱");

    expect(readiness.readiness).toBe("v1_manual_confirmation_required");
    expect(readiness.reasons).toContain("water_tank_manual_confirmation");
    expect(readiness.reasons).toContain("complex_multi_code_mapping");
    expect(readiness.reasons).toContain("complex_packaging_or_spec_mapping");
    expect(requiresV1ManualConfirmation("水箱")).toBe(true);
  });

  it("中冷器是 v1_manual_confirmation_required", () => {
    const readiness = getQuoteV1SourceReadiness("中冷器");

    expect(readiness.readiness).toBe("v1_manual_confirmation_required");
    expect(readiness.reasons).toContain("intercooler_manual_confirmation");
    expect(readiness.reasons).toContain("complex_multi_code_mapping");
    expect(readiness.reasons).toContain("complex_packaging_or_spec_mapping");
    expect(requiresV1ManualConfirmation("中冷器")).toBe(true);
  });

  it("特殊包装及其他是 addon_only，不能作为 V1 产品标准报价行", () => {
    const readiness = getQuoteV1SourceReadiness("特殊包装及其他");

    expect(readiness.readiness).toBe("addon_only");
    expect(readiness.allowedForV1ProductDraft).toBe(false);
    expect(readiness.allowedAsAddonOnly).toBe(true);
    expect(readiness.warnings.join("\n")).toContain("不能作为产品标准报价行");
    expect(isQuoteAddonOnlyCategory("特殊包装及其他")).toBe(true);
  });

  it("未知品类进入 deferred 并要求技术确认", () => {
    const readiness = getQuoteV1SourceReadiness("未知品类");

    expect(readiness.readiness).toBe("deferred");
    expect(readiness.allowedForV1ProductDraft).toBe(false);
    expect(readiness.requiresManualConfirmation).toBe(true);
    expect(readiness.warnings.join("\n")).toContain("需技术确认");
  });

  it("deferred 能力包含 OEM、正式报价、价格审批和 Excel 图片主图", () => {
    expect(getDeferredQuoteV1Capabilities()).toEqual(
      expect.arrayContaining(["OEM 自动匹配", "正式报价", "价格审批", "Excel 嵌入图片作为稳定主图"])
    );
  });

  it("generateV1QuoteDraftCandidates 为水箱加人工确认 warning", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJRAD001 10"), v1Catalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1Readiness).toBe("v1_manual_confirmation_required");
    expect(candidate.requiresManualConfirmation).toBe(true);
    expect(candidate.warnings.join("\n")).toContain("水箱存在多编码、多规格、多包装字段，V1 需要人工确认。");
  });

  it("generateV1QuoteDraftCandidates 为中冷器加人工确认 warning", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJINT001 10"), v1Catalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1Readiness).toBe("v1_manual_confirmation_required");
    expect(candidate.requiresManualConfirmation).toBe(true);
    expect(candidate.warnings.join("\n")).toContain("中冷器存在多编码、多规格、多包装字段，V1 需要人工确认。");
  });

  it("generateV1QuoteDraftCandidates 为特殊包装加 addon-only warning", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJPACK001 10"), v1Catalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1Readiness).toBe("addon_only");
    expect(candidate.isAddonOnly).toBe(true);
    expect(candidate.warnings.join("\n")).toContain("特殊包装及其他只能作为包装 / 附加项候选");
  });

  it("v1_auto_eligible 行仍提示价格候选不是财务批准价格", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJCOND001 10"), v1Catalog);

    expect(candidate.v1Readiness).toBe("v1_auto_eligible");
    expect(candidate.priceStatus).toBe("not_finance_approved");
    expect(candidate.warnings.join("\n")).toContain("价格候选不是财务批准价格");
  });

  it("OEM 输入仍然 oem_not_supported_yet", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("16400-XXXXX 300"), v1Catalog);

    expect(candidate.matchStatus).toBe("oem_not_supported_yet");
    expect(candidate.v1Readiness).toBe("deferred");
    expect(candidate.warnings.join("\n")).toContain("OEM / OE 自动匹配暂未开放。");
  });

  it("未知品类匹配后转为 requires_technical_review", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJUNKNOWN001 1"), v1Catalog);

    expect(candidate.matchStatus).toBe("requires_technical_review");
    expect(candidate.v1Readiness).toBe("deferred");
  });

  it("基础 KJ 多候选不能静默选第一行，必须保留人工确认 warning", () => {
    const [candidate] = generateV1QuoteDraftCandidates(parseQuoteDraftInput("KJBASE001 1"), v1Catalog);

    expect(candidate.matchStatus).toBe("ambiguous_kj");
    expect(candidate.requiresManualConfirmation).toBe(true);
    expect(candidate.warnings.join("\n")).toContain("基础 KJ 多候选不能静默选择第一行");
  });

  it("历史日期价格列不能作为 V1 默认候选", () => {
    const readiness = getQuoteV1SourceReadiness("水箱");

    expect(readiness.warnings.join("\n")).toContain("历史日期价格列不作为 V1 默认候选");
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
    const lines = parseQuoteDraftInput(["KJCOND001 1", "KJRAD001 2", "KJPACK001 3"].join("\n"));
    const candidates = generateV1QuoteDraftCandidates(lines, v1Catalog);

    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.v1Readiness)).toEqual([
      "v1_auto_eligible",
      "v1_manual_confirmation_required",
      "addon_only"
    ]);
  });
});
