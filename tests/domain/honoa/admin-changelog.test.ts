import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RELEASE_NOTES } from "@/lib/honoa/shared/release-notes";

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("管理员版本更新日志和 SaaS 视觉基线", () => {
  it("管理员首页显示版本更新日志入口", () => {
    const source = readRepoFile("app/admin/page.tsx");

    expect(source).toContain("版本更新日志");
    expect(source).toContain('href="/admin/changelog"');
  });

  it("/admin/changelog 页面存在并展示 release notes", () => {
    const source = readRepoFile("app/admin/changelog/page.tsx");

    expect(source).toContain("版本更新日志");
    expect(source).toContain("RELEASE_NOTES");
    expect(source).toContain("migration");
    expect(source).toContain("productionDataCommand");
    expect(source).toContain("productionDataRisk");
  });

  it("普通业务员不能访问 changelog", () => {
    const source = readRepoFile("app/admin/changelog/page.tsx");

    expect(source).toContain('user.role !== "super_admin" && user.role !== "admin"');
    expect(source).toContain("当前账号不能查看管理员版本更新日志");
  });

  it("release-notes.ts 至少包含最近一次 Finance dry-run 更新和报价草稿历史更新", () => {
    expect(RELEASE_NOTES[0].id).toBe("2026-05-13-08-quote-source-staging-metadata-schema");
    expect(RELEASE_NOTES[0].title).toContain("staging metadata schema");
    expect(RELEASE_NOTES[0].migration).toBe("additive");
    expect(RELEASE_NOTES[0].productionDataCommand).toBe("none");
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-13-04-finance-quote-source-dry-run-page")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-12-06-quote-draft-workbench-readability")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-12-05-quote-draft-workbench-mock")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-12-04-quote-draft-parser-dry-run")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-12-03-quote-draft-parser-memory-prototype")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-12-02-quote-draft-parser-design")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-12-01-quote-draft-data-audit")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-07-11-customer-archive-ui-form-layout")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-07-12-admin-changelog-saas-visual-baseline")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.id === "2026-05-07-13-attachment-field-ui-dedup")).toBe(true);
    expect(RELEASE_NOTES.some((note) => note.title.includes("版本更新日志"))).toBe(true);
  });

  it("docs/CHANGELOG.md 存在并包含 migration / data risk 信息", () => {
    const filePath = path.join(root, "docs/CHANGELOG.md");
    const source = readRepoFile("docs/CHANGELOG.md");

    expect(existsSync(filePath)).toBe(true);
    expect(source).toContain("2026.05.13-08");
    expect(source).toContain("Quote Task 006B");
    expect(source).toContain("2026.05.13-04");
    expect(source).toContain("Quote Task 005A");
    expect(source).toContain("2026.05.12-06");
    expect(source).toContain("Quote Task 002B");
    expect(source).toContain("2026.05.12-05");
    expect(source).toContain("Quote Task 002A");
    expect(source).toContain("2026.05.12-04");
    expect(source).toContain("Quote Task 001C");
    expect(source).toContain("2026.05.12-03");
    expect(source).toContain("Quote Task 001B");
    expect(source).toContain("2026.05.12-02");
    expect(source).toContain("Quote Task 001A");
    expect(source).toContain("2026.05.12-01");
    expect(source).toContain("Quote Task 000");
    expect(source).toContain("2026.05.07-13");
    expect(source).toContain("2026.05.07-12");
    expect(source).toContain("Migration：无");
    expect(source).toContain("生产数据命令：未运行");
    expect(source).toContain("生产数据风险：无");
  });

  it("Codex prompt template 存在并包含版本更新日志要求", () => {
    const filePath = path.join(root, "docs/09-codex-task-prompt-template.md");
    const source = readRepoFile("docs/09-codex-task-prompt-template.md");

    expect(existsSync(filePath)).toBe(true);
    expect(source).toContain("版本更新日志要求");
    expect(source).toContain("docs/CHANGELOG.md");
    expect(source).toContain("lib/honoa/shared/release-notes.ts");
    expect(source).toContain("如果本轮有用户可见变化但没有更新版本日志，则本轮不能视为完成");
  });

  it("全局 CSS 建立 KingaOS SaaS 视觉 tokens 和统一组件风格", () => {
    const css = readRepoFile("app/globals.css");

    expect(css).toContain("--kinga-bg");
    expect(css).toContain("--kinga-primary");
    expect(css).toContain("--kinga-shadow-md");
    expect(css).toContain(".page-hero");
    expect(css).toContain(".release-card");
    expect(css).toContain(".filter-pill");
  });

  it("客户列表和客户编辑页仍保留核心结构", () => {
    const customersPage = readRepoFile("app/export/customers/page.tsx");
    const customerForm = readRepoFile("components/server-customer-form.tsx");
    const receiptAccountSelector = readRepoFile("components/customer-receipt-account-selector.tsx");

    expect(customersPage).toContain("customer-table-scroll");
    expect(customersPage).toContain("默认收款方案");
    expect(customerForm).toContain("customer-type-multiselect");
    expect(receiptAccountSelector).toContain("财务维护，业务只读");
  });
});
