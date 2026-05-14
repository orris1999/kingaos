import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  generateV1QuoteDraftCandidates,
  parseQuoteDraftInput,
  QUOTE_DRAFT_MOCK_CATALOG
} from "@/lib/honoa/quote-draft";

function readRepoFile(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

describe("Quote Task 002C 出口部 KJ 报价草稿 Workbench", () => {
  it("/admin 页面不再显示报价草稿 Workbench 入口", () => {
    const page = readRepoFile("app/admin/page.tsx");

    expect(page).not.toContain("/admin/quote-draft-workbench");
    expect(page).not.toContain("/export/quote-draft-workbench");
    expect(page).not.toContain("内部 mock 解析器演示");
  });

  it("/export 页面显示 workbench 入口但只给 super_admin", () => {
    const page = readRepoFile("app/export/page.tsx");

    expect(page).toContain("/export/quote-draft-workbench");
    expect(page).toContain('user.role === "super_admin"');
    expect(page).toContain("内部 mock 解析器演示");
  });

  it("/export/quote-draft-workbench 页面存在并只允许 super_admin", () => {
    const page = readRepoFile("app/export/quote-draft-workbench/page.tsx");

    expect(page).toContain("QuoteDraftWorkbench");
    expect(page).toContain('user.role !== "super_admin"');
    expect(page).toContain("当前账号不能查看报价草稿解析器 Workbench");
    expect(page).toContain("isExportStagingQuoteDraftEnabled");
    expect(page).toContain("isExportQuoteDraftExcelEnabled");
    expect(page).toContain("excelExportEnabled={excelExportEnabled}");
    expect(page).toContain("findExportQuoteDraftSourceCandidatesAction");
    expect(page).toContain("stagingCandidatesEnabled ? findExportQuoteDraftSourceCandidatesAction : undefined");
  });

  it("旧 /admin/quote-draft-workbench 重定向到出口部 canonical route", () => {
    const page = readRepoFile("app/admin/quote-draft-workbench/page.tsx");

    expect(page).toContain('redirect("/export/quote-draft-workbench")');
    expect(page).not.toContain("@/components/quote-draft-workbench");
    expect(page).not.toContain("<QuoteDraftWorkbench");
  });

  it("页面显示 mock 数据、财务维护报价表和不是正式报价警示", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");

    expect(component).toContain("当前使用 mock 数据，不读取真实报价表");
    expect(component).toContain("未来真实报价表 / 成本表 / 价格候选数据由财务提交和维护");
    expect(component).toContain("出口部只能基于财务数据生成报价草稿，不能上传或维护价格表");
    expect(component).toContain("本页面不会生成正式报价");
    expect(component).toContain("价格候选不是财务批准价格");
    expect(component).toContain("不能发客户");
  });

  it("预览状态和销售模式显示为业务可读中文标签", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");

    expect(component).toContain("可生成草稿预览");
    expect(component).toContain("未找到候选");
    expect(component).toContain("多候选，需选择");
    expect(component).toContain("需人工确认");
    expect(component).toContain("OEM 暂未开放");
    expect(component).toContain("缺少数量");
    expect(component).toContain("staging 数据源未开放");
    expect(component).toContain("错误");
    expect(component).toContain("外销 USD / export_usd");
    expect(component).toContain("内销 CNY / domestic_cny");
    expect(component).toContain("未指定 / unknown");
    expect(component).toContain("非财务批准价格");
  });

  it("页面提供草稿预览汇总、输入体验、数据源选择和复制预览 JSON", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");
    const mockCatalog = readRepoFile("lib/honoa/quote-draft/mock-catalog.ts");
    const summaryHelper = readRepoFile("lib/honoa/quote-draft/export-quote-draft-preview-summary.ts");

    expect(component).toContain('data-testid="quote-draft-summary"');
    expect(component).toContain('data-testid="quote-draft-preview-table"');
    expect(component).toContain("总行数");
    expect(component).toContain("可生成草稿预览");
    expect(component).toContain("未找到候选");
    expect(component).toContain("多候选，需选择");
    expect(component).toContain("OEM 暂未开放");
    expect(component).toContain("缺少数量");
    expect(component).toContain("销售模式");
    expect(component).toContain("备注");
    expect(component).toContain("填入示例");
    expect(component).toContain("清空");
    expect(component).toContain("复制预览 JSON");
    expect(component).toContain("导出草稿 Excel");
    expect(component).toContain("Excel 导出暂未开放");
    expect(component).toContain("暂无可导出内容");
    expect(component).toContain("生成草稿预览");
    expect(component).toContain("Mock 数据");
    expect(component).toContain("财务确认 staging 候选");
    expect(component).toContain("财务确认 staging 候选暂未开放");
    expect(component).toContain('data-testid="quote-draft-action-items"');
    expect(component).toContain("待处理事项");
    expect(component).toContain("Excel 导出只导出当前页面预览结果");
    expect(component).toContain('await import("xlsx")');
    expect(component).toContain("buildExportQuoteDraftWorkbookRows");
    expect(component).toContain("buildExportQuoteDraftExcelFileName");
    expect(summaryHelper).toContain("缺少数量，请补充数量");
    expect(summaryHelper).toContain("未找到财务确认 staging 候选");
    expect(summaryHelper).toContain("多候选，需要选择正确 KJ");
    expect(summaryHelper).toContain("OEM 暂未开放，请先通过技术确认找到 KJ");
    expect(summaryHelper).toContain("价格候选不是财务批准价格，不能直接发客户");
    expect(mockCatalog).toContain("KJMOCK-COND-001 100pcs");
    expect(mockCatalog).toContain("KJMOCK-RAD-PA16-A 80");
    expect(mockCatalog).toContain("KJMOCK-RAD-BASE-001 50");
    expect(mockCatalog).toContain("KJMOCK-IC-001 60");
    expect(mockCatalog).toContain("KJMOCK-IC-OLD-001 30");
    expect(mockCatalog).toContain("KJMOCK-PACK-001 20");
    expect(mockCatalog).toContain("UNKNOWN123");
    expect(mockCatalog).not.toContain("KJ" + "12345");
  });

  it("输入普通冷凝器 mock 后能生成可进入 V1 草稿行", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK-COND-001 100pcs");
    const [candidate] = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.kjCode).toBe("KJMOCK-COND-001");
    expect(candidate.productName).toBe("Mock Condenser");
    expect(candidate.quantity).toBe(100);
    expect(candidate.v1ReadinessLabel).toBe("可进入 V1 草稿");
  });

  it("水箱完整标准 KJ 唯一匹配可进入 V1 草稿", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK-RAD-PA16-A 80");
    const [candidate] = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1Readiness).toBe("v1_eligible_with_conditions");
    expect(candidate.v1ReadinessLabel).toBe("可进入 V1 草稿");
    expect(candidate.requiresManualConfirmation).toBe(false);
  });

  it("水箱基础 KJ 多候选显示需人工确认", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK-RAD-BASE-001 50");
    const [candidate] = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.matchStatus).toBe("ambiguous_kj");
    expect(candidate.v1ReadinessLabel).toBe("需人工确认");
    expect(candidate.requiresManualConfirmation).toBe(true);
  });

  it("中冷器旧码匹配显示需人工确认", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK-IC-OLD-001 30");
    const [candidate] = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.v1ReadinessLabel).toBe("需人工确认");
    expect(candidate.v1LineRisks).toContain("old_kj_code_match");
  });

  it("特殊包装 mock 显示仅附加项候选", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK-PACK-001 20");
    const [candidate] = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.v1Readiness).toBe("addon_only");
    expect(candidate.v1ReadinessLabel).toBe("仅附加项候选");
    expect(candidate.isAddonOnly).toBe(true);
  });

  it("OEM / OE 输入显示 oem_not_supported_yet", () => {
    const inputLines = parseQuoteDraftInput("16400-XXXXX 300");
    const [candidate] = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);

    expect(candidate.matchStatus).toBe("oem_not_supported_yet");
    expect(candidate.v1ReadinessLabel).toBe("暂缓");
    expect(candidate.warnings).toContain("OEM / OE 自动匹配暂未开放，请提供 KJ 或进入人工匹配。");
  });

  it("workbench 不保存数据、不读取真实报价表，staging 查询只通过 feature-gated 只读 action", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");
    const page = readRepoFile("app/export/quote-draft-workbench/page.tsx");
    const mockCatalog = readRepoFile("lib/honoa/quote-draft/mock-catalog.ts");
    const action = readRepoFile("lib/honoa/quote-draft/export-staging-consumption-actions.ts");

    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("action=");
    expect(component).not.toContain("server action");
    expect(page).not.toContain("PrismaClient");
    expect(page).toContain("stagingCandidatesEnabled ? findExportQuoteDraftSourceCandidatesAction : undefined");
    expect(action).toContain("requireCurrentUser");
    expect(action).toContain('actor.role !== "super_admin"');
    expect(action).toContain("findExportQuoteDraftSourceCandidates(prisma, input)");
    expect(mockCatalog).not.toContain(".xlsx");
    expect(mockCatalog).not.toContain(".xls");
    expect(mockCatalog).toContain("KJMOCK-COND-001");
    expect(mockCatalog).not.toContain("KJ" + "12345");
  });

  it("输出和页面源码不包含正式报价状态字段", () => {
    const inputLines = parseQuoteDraftInput("KJMOCK-COND-001 100pcs");
    const [candidate] = generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG);
    const serialized = JSON.stringify(candidate) + readRepoFile("components/quote-draft-workbench.tsx");

    expect(serialized).not.toContain("finance" + "Approved" + "Price");
    expect(serialized).not.toContain("official" + "Quote");
    expect(serialized).not.toContain(["sent", "to", "customer"].join("_"));
  });

  it("staging 数据源关闭时 disabled，开启后仅查询脱敏候选并保留业务警示", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");
    const flagHelper = readRepoFile("lib/honoa/server/feature-flags.ts");

    expect(flagHelper).toContain("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT");
    expect(flagHelper).toContain("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL");
    expect(flagHelper).not.toContain("NEXT_PUBLIC_");
    expect(component).toContain('disabled={!stagingCandidatesEnabled}');
    expect(component).toContain("disabled={!excelExportEnabled || previewLines.length === 0 || isExcelExportPending}");
    expect(component).toContain("财务确认 staging 候选暂未开放。默认只使用 Mock 数据");
    expect(component).toContain("Excel 导出暂未开放。");
    expect(component).toContain("未找到候选");
    expect(component).toContain("OEM 暂未开放");
    expect(component).toContain("非财务批准价格，仅草稿候选");
    expect(component).toContain("finance_confirmed staging");
    expect(component).toContain("finance_confirmed 不等于 FinanceApprovedPrice");
    expect(component).toContain('data-testid="quote-draft-trade-mode"');
  });
});
