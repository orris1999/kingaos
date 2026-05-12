import { describe, expect, it } from "vitest";
import {
  createQuoteSourceDryRunSummarySkeleton,
  QUOTE_SOURCE_WORKBOOK_CONFIGS
} from "@/lib/honoa/quote-draft";

const EXPECTED_CATEGORIES = [
  "冷凝器",
  "暖风",
  "水箱",
  "蒸发器",
  "中冷器",
  "水室",
  "特殊包装及其他",
  "全铝自产机冷"
];

function collectConfigText() {
  return JSON.stringify(QUOTE_SOURCE_WORKBOOK_CONFIGS);
}

describe("Quote Task 003A 报价表 adapter 配置", () => {
  it("8 个 adapter config 都存在并覆盖指定品类", () => {
    expect(QUOTE_SOURCE_WORKBOOK_CONFIGS).toHaveLength(8);
    expect(QUOTE_SOURCE_WORKBOOK_CONFIGS.map((config) => config.category).sort()).toEqual(EXPECTED_CATEGORIES.sort());
  });

  it("每个 adapter 都有基础 workbook 元数据", () => {
    for (const config of QUOTE_SOURCE_WORKBOOK_CONFIGS) {
      expect(config.id).toBeTruthy();
      expect(config.category).toBeTruthy();
      expect(config.fileNamePattern).toBeTruthy();
      expect(config.supportedFileTypes.length).toBeGreaterThan(0);
      expect(config.submittedByRole).toBe("finance");
      expect(config.consumerDepartment).toBe("export");
      expect(config.primarySheets.length).toBeGreaterThan(0);
    }
  });

  it("每个 primary sheet 都声明字段映射和价格字段策略", () => {
    for (const config of QUOTE_SOURCE_WORKBOOK_CONFIGS) {
      for (const sheet of config.primarySheets) {
        expect(sheet.columnMapping).toBeTruthy();
        expect(sheet.priceFieldStrategy).toBeTruthy();
        expect(sheet.priceFieldStrategy).not.toBe("finance_approved");
      }
    }
  });

  it("水箱 / 中冷器 adapter 标记结构复杂风险", () => {
    const radiator = QUOTE_SOURCE_WORKBOOK_CONFIGS.find((config) => config.category === "水箱");
    const intercooler = QUOTE_SOURCE_WORKBOOK_CONFIGS.find((config) => config.category === "中冷器");

    expect(JSON.stringify(radiator)).toContain("结构复杂");
    expect(JSON.stringify(intercooler)).toContain("结构与水箱相近");
    expect(JSON.stringify(intercooler)).toContain("单独配置");
  });

  it("特殊包装 adapter 标记不能直接视为产品标准报价", () => {
    const specialPackaging = QUOTE_SOURCE_WORKBOOK_CONFIGS.find((config) => config.category === "特殊包装及其他");
    const text = JSON.stringify(specialPackaging);

    expect(text).toContain("不能直接视为产品标准报价");
    expect(text).toContain("包装附加项候选");
    expect(text).toContain("没有稳定 KJ / OEM 主键");
  });

  it("adapter 配置不包含真实价格值或正式报价业务字段", () => {
    const text = collectConfigText();

    expect(text).not.toMatch(/\b\d+\.\d{2}\b/);
    expect(text).not.toContain("amount");
    expect(text).not.toContain("priceValue");
    expect(text).not.toContain("finance" + "Approved" + "Price");
    expect(text).not.toContain("official" + "Quote");
    expect(text).not.toContain("sent" + "To" + "Customer");
    expect(text).not.toContain("minimum" + "Price");
    expect(text).not.toContain("gross" + "Margin");
  });

  it("dry-run summary 结构明确 finance 提交和 export 消费", () => {
    const [config] = QUOTE_SOURCE_WORKBOOK_CONFIGS;
    const summary = createQuoteSourceDryRunSummarySkeleton(config, "mock-file.xlsx");

    expect(summary.sourceFileName).toBe("mock-file.xlsx");
    expect(summary.adapterId).toBe(config.id);
    expect(summary.submittedByRole).toBe("finance");
    expect(summary.consumerDepartment).toBe("export");
    expect(summary.matchedAdapter).toBe(false);
    expect(summary.detectedSheets).toEqual([]);
    expect(summary.warnings.join(" ")).toContain("不写生产数据库");
    expect(summary.warnings.join(" ")).toContain("财务提交和维护");
  });
});
