import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Quote Task 007A Finance quote source staging 只读页面", () => {
  it("/finance 页面显示报价表 staging 入口", () => {
    const page = readRepoFile("app/finance/page.tsx");

    expect(page).toContain("报价表 staging");
    expect(page).toContain('href="/finance/quote-source-staging"');
    expect(page).toContain('user.role === "super_admin"');
    expect(page).toContain("只读预览");
    expect(page).toContain("当前只读，不执行确认");
  });

  it("/finance/quote-source-staging 页面存在并只允许 super_admin", () => {
    const pagePath = path.join(root, "app/finance/quote-source-staging/page.tsx");
    const page = readRepoFile("app/finance/quote-source-staging/page.tsx");

    expect(existsSync(pagePath)).toBe(true);
    expect(page).toContain('user.role !== "super_admin"');
    expect(page).toContain("当前账号不能查看 Finance 报价表 staging");
    expect(page).toContain("FinanceQuoteSourceStagingList");
  });

  it("/finance/quote-source-staging 空状态可显示", () => {
    const component = readRepoFile("components/finance-quote-source-staging-list.tsx");

    expect(component).toContain("暂无 staging 批次");
    expect(component).toContain("请先在 Finance 报价表 dry-run 页面完成结构识别和后续确认流程设计");
    expect(component).toContain("当前页面只读，不执行确认，不生成正式报价");
  });

  it("/finance/quote-source-staging/[batchId] 页面存在并只允许 super_admin", () => {
    const pagePath = path.join(root, "app/finance/quote-source-staging/[batchId]/page.tsx");
    const page = readRepoFile("app/finance/quote-source-staging/[batchId]/page.tsx");

    expect(existsSync(pagePath)).toBe(true);
    expect(page).toContain('user.role !== "super_admin"');
    expect(page).toContain("当前账号不能查看 Finance 报价表 staging");
    expect(page).toContain("FinanceQuoteSourceStagingDetail");
  });

  it("详情页展示只读确认区域和 disabled 按钮", () => {
    const component =
      readRepoFile("components/finance-quote-source-staging-detail.tsx") +
      readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(component).toContain("当前确认功能未启用。本页仅展示 staging 批次，不执行写入");
    expect(component).toContain("确认进入草稿候选（暂未开放）");
    expect(component).toContain("退回修正（下一阶段开放）");
    expect(component).toContain("取消批次（下一阶段开放）");
    expect(component).toContain("<button type=\"button\" disabled>");
  });

  it("详情页展示 staging 风险边界", () => {
    const component = readRepoFile("components/finance-quote-source-staging-detail.tsx");

    expect(component).toContain("成本价不是财务批准价格");
    expect(component).toContain("finance_confirmed 不等于 FinanceApprovedPrice");
    expect(component).toContain("export_draft_candidate 不是正式报价");
    expect(component).toContain("needs_manual_review 默认不会给出口部消费");
    expect(component).toContain("addon_only / blocked / ignored 不会给出口部消费");
  });

  it("页面只读查询 staging 数据，写入只通过 feature-gated confirm form", () => {
    const listPage = readRepoFile("app/finance/quote-source-staging/page.tsx");
    const detailPage = readRepoFile("app/finance/quote-source-staging/[batchId]/page.tsx");
    const source = listPage + detailPage;

    expect(source).toContain("findMany");
    expect(source).toContain("findUnique");
    expect(source).not.toContain("confirmQuoteSourceStagingBatchForDraftCandidates");
    expect(source).toContain("isFinanceStagingConfirmEnabled");
    expect(source).not.toMatch(/quoteSourceStagingBatch\.(create|update|delete|deleteMany|upsert)/);
    expect(source).not.toMatch(/quoteSourceStagingRow\.(create|update|delete|deleteMany|upsert)/);
    expect(source).not.toContain('"use server"');
    expect(source).not.toContain("'use server'");
  });

  it("页面没有新增 API route，确认表单由服务端 feature flag 控制", () => {
    const listComponent = readRepoFile("components/finance-quote-source-staging-list.tsx");
    const detailComponent =
      readRepoFile("components/finance-quote-source-staging-detail.tsx") +
      readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(existsSync(path.join(root, "app/api/finance/quote-source-staging"))).toBe(false);
    expect(detailComponent).toContain("enabled: boolean");
    expect(detailComponent).toContain("rowVisibilityPolicy");
    expect(detailComponent).toContain("strict_candidate_only");
    expect(listComponent + detailComponent).not.toContain("fetch(");
  });

  it("页面不显示敏感价格字段作为数据列", () => {
    const listComponent = readRepoFile("components/finance-quote-source-staging-list.tsx");
    const detailComponent = readRepoFile("components/finance-quote-source-staging-detail.tsx");
    const source = listComponent + detailComponent;

    expect(source).not.toContain("amount");
    expect(source).not.toContain("cost" + "Price");
    expect(source).not.toContain("unit" + "Price");
    expect(source).not.toContain("minimum" + "Price");
    expect(source).not.toContain("gross" + "Margin");
    expect(source).not.toContain("margin");
    expect(source).not.toContain("profit");
  });

  it("本轮未新增权限 seed 或 Prisma migration", () => {
    const seed = readRepoFile("prisma/seed.mjs");
    const seedData = readRepoFile("prisma/seed-data.mjs");

    expect(seed).not.toContain("finance.quote_source_staging.view");
    expect(seedData).not.toContain("finance.quote_source_staging.view");
    expect(existsSync(path.join(root, "prisma/migrations/20260513140000_finance_staging_readonly_page"))).toBe(false);
  });
});
