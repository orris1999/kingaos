import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createQuoteSourceDryRunSummaryFromMetadata,
  matchQuoteSourceAdapter
} from "@/lib/honoa/quote-draft";
import type { QuoteSourceWorkbookMetadata } from "@/lib/honoa/quote-draft";

function sourceText() {
  return [
    "../../../lib/honoa/quote-draft/source-adapter-matcher.ts",
    "../../../lib/honoa/quote-draft/source-adapter-types.ts"
  ]
    .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
    .join("\n");
}

describe("Quote Task 003B 报价表 adapter matcher", () => {
  it("能按冷凝器文件名匹配 condenser adapter", () => {
    const result = matchQuoteSourceAdapter({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: []
    });

    expect(result.matchedAdapter).toBe(true);
    expect(result.adapterId).toBe("condenser-cost-2026");
    expect(result.category).toBe("冷凝器");
    expect(result.confidence).toBe("medium");
    expect(result.submittedByRole).toBe("finance");
    expect(result.consumerDepartment).toBe("export");
  });

  it("能按水箱文件名匹配 radiator adapter", () => {
    const result = matchQuoteSourceAdapter({
      sourceFileName: "mock-水箱成本报价表.xlsx",
      fileType: "xlsx",
      detectedSheets: []
    });

    expect(result.matchedAdapter).toBe(true);
    expect(result.adapterId).toBe("radiator-cost-2026");
    expect(result.category).toBe("水箱");
  });

  it("文件类型未知时产生 unsupportedReason", () => {
    const result = matchQuoteSourceAdapter({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "unknown",
      detectedSheets: ["2026年冷凝器成本核算"]
    });

    expect(result.matchedAdapter).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.unsupportedReasons.join(" ")).toContain("文件类型未知");
  });

  it("文件名和 sheet 都匹配时 confidence = high", () => {
    const result = matchQuoteSourceAdapter({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["2026年冷凝器成本核算"]
    });

    expect(result.confidence).toBe("high");
    expect(result.matchedReasons.join(" ")).toContain("文件名命中");
    expect(result.matchedReasons.join(" ")).toContain("sheet 名称命中");
  });

  it("只有文件名匹配时 confidence = medium", () => {
    const result = matchQuoteSourceAdapter({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["随机 sheet"]
    });

    expect(result.confidence).toBe("medium");
  });

  it("只有 sheet 匹配时 confidence = low", () => {
    const result = matchQuoteSourceAdapter({
      sourceFileName: "random.xlsx",
      fileType: "xlsx",
      detectedSheets: ["2026年 水箱成本报价表"]
    });

    expect(result.matchedAdapter).toBe(true);
    expect(result.adapterId).toBe("radiator-cost-2026");
    expect(result.confidence).toBe("low");
  });

  it("完全不匹配时 matchedAdapter = false", () => {
    const result = matchQuoteSourceAdapter({
      sourceFileName: "random.xlsx",
      fileType: "xlsx",
      detectedSheets: ["random sheet"]
    });

    expect(result.matchedAdapter).toBe(false);
    expect(result.confidence).toBe("none");
    expect(result.unsupportedReasons.join(" ")).toContain("未匹配到报价表 adapter");
  });

  it("dry-run summary 包含 finance 提交和 export 消费边界", () => {
    const summary = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["2026年冷凝器成本核算"]
    });

    expect(summary.submittedByRole).toBe("finance");
    expect(summary.consumerDepartment).toBe("export");
    expect(summary.matchedAdapter).toBe(true);
  });

  it("dry-run summary 不包含真实价格值", () => {
    const summary = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["2026年冷凝器成本核算"],
      detectedHeadersBySheet: {
        "2026年冷凝器成本核算": ["KJ编码", "OE", "出口成本", "车型车系"]
      }
    });

    const text = JSON.stringify(summary);
    expect(text).not.toContain("12.5");
    expect(text).not.toContain("99.9");
    expect(text).not.toContain("amount");
  });

  it("mappedColumns 能匹配 KJ / OEM / costPrice 的列名候选", () => {
    const summary = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["2026年冷凝器成本核算"],
      detectedHeadersBySheet: {
        "2026年冷凝器成本核算": ["KJ编码", "OE", "2026.5.11出口成本", "车型车系"]
      }
    });

    expect(summary.mappedColumns.kjCode).toEqual(["KJ编码"]);
    expect(summary.mappedColumns.oemCode).toEqual(["OE"]);
    expect(summary.mappedColumns.costPrice).toEqual(["2026.5.11出口成本"]);
    expect(summary.mappedColumns.quotePrice).toBeUndefined();
    expect(summary.mappedColumns.productName).toEqual(["车型车系"]);
  });

  it("缺少关键列时产生 warning", () => {
    const summary = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["2026年冷凝器成本核算"],
      detectedHeadersBySheet: {
        "2026年冷凝器成本核算": ["备注"]
      }
    });

    const warnings = summary.warnings.join(" ");
    expect(warnings).toContain("缺少 KJ 编号列候选");
    expect(warnings).toContain("缺少产品名称列候选");
    expect(warnings).toContain("缺少成本候选列");
  });

  it("warnings 保留成本价和出口部维护报价表的红线", () => {
    const summary = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-冷凝器成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["2026年冷凝器成本核算"]
    });

    const warnings = summary.warnings.join(" ");
    expect(warnings).toContain("成本价不是财务批准价格");
    expect(warnings).toContain("出口部不能上传或维护报价表");
  });

  it("水箱 / 中冷器 dry-run warnings 固化人工确认和 OEM 暂缓规则", () => {
    const radiator = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-水箱成本报价表.xlsx",
      fileType: "xlsx",
      detectedSheets: ["2026年 水箱成本报价表"]
    });
    const intercooler = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-中冷器成本报价表.xlsx",
      fileType: "xlsx",
      detectedSheets: ["2026年 中冷器成本报价表"]
    });

    for (const summary of [radiator, intercooler]) {
      const warnings = summary.warnings.join(" ");
      expect(warnings).toContain("报价表由财务提交和维护");
      expect(warnings).toContain("出口部不能上传或维护报价表");
      expect(warnings).toContain("成本价不是财务批准价格");
      expect(warnings).toContain("manual_confirmation_required");
      expect(warnings).toContain("complex_multi_code_mapping");
      expect(warnings).toContain("complex_packaging_or_spec_mapping");
      expect(warnings).toContain("oem_matching_deferred");
      expect(warnings).toContain("embedded_excel_image_not_stable");
      expect(warnings).toContain("不能静默自动匹配");
    }
  });

  it("特殊包装 dry-run warnings 标记只能作为包装附加项候选", () => {
    const summary = createQuoteSourceDryRunSummaryFromMetadata({
      sourceFileName: "mock-特殊包装及其他成本报价表.xls",
      fileType: "xls",
      detectedSheets: ["2026年5月特殊包装及其他成本报价表"]
    });

    const warnings = summary.warnings.join(" ");
    expect(warnings).toContain("packaging_addon_not_product_line");
    expect(warnings).toContain("addon_only");
    expect(warnings).toContain("not_product_standard_quote");
    expect(warnings).toContain("不能作为产品标准报价");
  });

  it("代码业务类型不引入正式报价误导字段", () => {
    const text = sourceText();

    expect(text).not.toContain("finance" + "Approved" + "Price");
    expect(text).not.toContain("official" + "Quote");
    expect(text).not.toContain("sent" + "To" + "Customer");
    expect(text).not.toContain("minimum" + "Price");
    expect(text).not.toContain("gross" + "Margin");
  });
});
