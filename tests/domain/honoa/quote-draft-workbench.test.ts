import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  generateQuoteDraftCandidates,
  parseQuoteDraftInput,
  QUOTE_DRAFT_MOCK_CATALOG
} from "@/lib/honoa/quote-draft";

function readRepoFile(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

describe("Quote Task 002B 管理员 KJ 报价草稿 Workbench", () => {
  it("/admin/quote-draft-workbench 页面存在并只允许 super_admin", () => {
    const page = readRepoFile("app/admin/quote-draft-workbench/page.tsx");

    expect(page).toContain("QuoteDraftWorkbench");
    expect(page).toContain('user.role !== "super_admin"');
    expect(page).toContain("当前账号不能查看报价草稿解析器 Workbench");
  });

  it("管理员首页显示 workbench 入口但只给 super_admin", () => {
    const page = readRepoFile("app/admin/page.tsx");

    expect(page).toContain("/admin/quote-draft-workbench");
    expect(page).toContain('user.role === "super_admin"');
    expect(page).toContain("内部 mock 解析器演示");
  });

  it("页面显示 mock 数据和不是正式报价警示", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");

    expect(component).toContain("当前使用 mock 数据，不读取真实报价表");
    expect(component).toContain("本页面不会生成正式报价");
    expect(component).toContain("价格候选不是财务批准价格");
    expect(component).toContain("不能发客户");
  });

  it("状态显示为业务可读中文标签", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");

    expect(component).toContain("KJ 已匹配");
    expect(component).toContain("KJ 未找到");
    expect(component).toContain("KJ 多候选");
    expect(component).toContain("OEM 暂未开放");
    expect(component).toContain("需技术确认");
    expect(component).toContain("有图片");
    expect(component).toContain("缺图片");
    expect(component).toContain("仅 Excel 嵌入图");
    expect(component).toContain("无价格");
    expect(component).toContain("需财务核价");
    expect(component).toContain("非财务批准价格");
  });

  it("页面提供结果汇总、填入示例、清空和复制 mock JSON", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");
    const mockCatalog = readRepoFile("lib/honoa/quote-draft/mock-catalog.ts");

    expect(component).toContain('data-testid="quote-draft-summary"');
    expect(component).toContain("总行数");
    expect(component).toContain("KJ 已匹配");
    expect(component).toContain("KJ 未找到");
    expect(component).toContain("OEM 暂未开放");
    expect(component).toContain("填入示例");
    expect(component).toContain("清空");
    expect(component).toContain("复制结果 JSON");
    expect(mockCatalog).toContain("KJMOCK001 100pcs");
    expect(mockCatalog).toContain("KJMOCK002*200");
    expect(mockCatalog).toContain("KJMOCK-MISSING 50");
    expect(mockCatalog).toContain("UNKNOWN123");
    expect(mockCatalog).not.toContain("KJ" + "12345");
  });

  it("输入 KJMOCK001 100pcs 后能生成 matched_by_kj 行", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK001 100pcs");
    const [candidate] = generateQuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.kjCode).toBe("KJMOCK001");
    expect(candidate.productName).toBe("Mock Radiator");
    expect(candidate.quantity).toBe(100);
  });

  it("OEM / OE 输入显示 oem_not_supported_yet", () => {
    const inputLines = parseQuoteDraftInput("16400-XXXXX 300");
    const [candidate] = generateQuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.matchStatus).toBe("oem_not_supported_yet");
    expect(candidate.warnings).toContain("OEM / OE 自动匹配暂未开放，请提供 KJ 或进入人工匹配。");
  });

  it("workbench 不保存数据、不读取真实报价表、不接 API 或 server action", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");
    const page = readRepoFile("app/admin/quote-draft-workbench/page.tsx");
    const mockCatalog = readRepoFile("lib/honoa/quote-draft/mock-catalog.ts");

    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("action=");
    expect(page).not.toContain("PrismaClient");
    expect(mockCatalog).not.toContain(".xlsx");
    expect(mockCatalog).not.toContain(".xls");
    expect(mockCatalog).toContain("KJMOCK001");
    expect(mockCatalog).not.toContain("KJ" + "12345");
  });

  it("输出和页面源码不包含正式报价状态字段", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK001 100pcs");
    const [candidate] = generateQuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);
    const serialized = JSON.stringify(candidate) + readRepoFile("components/quote-draft-workbench.tsx");

    expect(serialized).not.toContain("finance" + "Approved" + "Price");
    expect(serialized).not.toContain("official" + "Quote");
    expect(serialized).not.toContain(["sent", "to", "customer"].join("_"));
  });
});
