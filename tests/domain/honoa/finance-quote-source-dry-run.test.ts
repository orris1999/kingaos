import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Quote Task 005A Finance 报价表 dry-run 页面", () => {
  it("/finance 页面显示 super_admin-only 的报价表 dry-run 入口", () => {
    const page = readRepoFile("app/finance/page.tsx");

    expect(page).toContain("报价表 dry-run");
    expect(page).toContain('href="/finance/quote-source-dry-run"');
    expect(page).toContain('user.role === "super_admin"');
    expect(page).toContain("内部测试");
    expect(page).toContain("不上传、不入库、不生成正式报价");
  });

  it("/finance/quote-source-dry-run 页面存在并只允许 super_admin", () => {
    const page = readRepoFile("app/finance/quote-source-dry-run/page.tsx");

    expect(page).toContain("FinanceQuoteSourceDryRun");
    expect(page).toContain('user.role !== "super_admin"');
    expect(page).toContain("当前账号不能查看 Finance 报价表 dry-run");
  });

  it("页面警示本地解析、不上传、不写数据库和价格边界", () => {
    const component = readRepoFile("components/finance-quote-source-dry-run.tsx");

    expect(component).toContain("Finance 报价表 dry-run");
    expect(component).toContain("本页面只做本地结构识别，不上传文件，不写数据库");
    expect(component).toContain("报价表 / 成本表 / 价格候选数据由财务提交和维护");
    expect(component).toContain("出口部不能上传或维护价格表");
    expect(component).toContain("dry-run 不生成报价草稿，不生成正式报价");
    expect(component).toContain("不是财务批准价格");
  });

  it("浏览器本地解析复用 adapter matcher，不新增上传到服务器的入口", () => {
    const component = readRepoFile("components/finance-quote-source-dry-run.tsx");
    const page = readRepoFile("app/finance/quote-source-dry-run/page.tsx");

    expect(component).toContain('await import("xlsx")');
    expect(component).toContain("matchQuoteSourceAdapter");
    expect(component).toContain("createQuoteSourceDryRunSummaryFromMetadata");
    expect(component).toContain("file.arrayBuffer()");
    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("form action");
    expect(page).not.toContain("server action");
    expect(page).not.toContain("PrismaClient");
  });

  it("页面展示 finance 提交 / export 消费边界和结构化字段检测", () => {
    const component = readRepoFile("components/finance-quote-source-dry-run.tsx");

    expect(component).toContain("submittedByRole");
    expect(component).toContain("consumerDepartment");
    expect(component).toContain("检测到 KJ 列");
    expect(component).toContain("检测到 OEM / OE 列");
    expect(component).toContain("检测到产品名称列");
    expect(component).toContain("检测到成本候选列");
    expect(component).toContain("检测到报价候选列");
    expect(component).toContain("检测到包装列");
  });

  it("页面不显示真实价格明细，也不引入正式报价误导字段", () => {
    const component = readRepoFile("components/finance-quote-source-dry-run.tsx");
    const page = readRepoFile("app/finance/quote-source-dry-run/page.tsx");
    const text = component + page;

    expect(text).not.toContain("finance" + "Approved" + "Price");
    expect(text).not.toContain("official" + "Quote");
    expect(text).not.toContain("sent" + "To" + "Customer");
    expect(text).not.toContain("minimum" + "Price");
    expect(text).not.toContain("gross" + "Margin");
    expect(component).not.toContain("amount");
    expect(component).not.toContain("rowSample");
  });
});
