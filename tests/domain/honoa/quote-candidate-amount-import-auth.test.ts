import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Quote Task 009R-Fix candidate amount import authenticated UAT path", () => {
  it("keeps the import route behind the current-user cookie boundary", () => {
    const route = readRepoFile("app/api/finance/quote-source-staging/[batchId]/import-candidate-amounts/route.ts");

    expect(route).toContain("getCurrentUser");
    expect(route).toContain("if (!user)");
    expect(route).toContain("status: 401");
    expect(route).toContain("isFinanceQuoteCandidateAmountImportEnabled");
    expect(route).toContain("importQuoteCandidateAmountsForBatch(user");
    expect(route).not.toContain("actorUserId");
    expect(route).not.toContain("candidateValue");
  });

  it("adds an authenticated same-origin page form instead of requiring no-cookie curl", () => {
    const formPath = "components/finance-quote-candidate-value-import-form.tsx";
    const form = readRepoFile(formPath);
    const detail = readRepoFile("components/finance-quote-source-staging-detail.tsx");
    const page = readRepoFile("app/finance/quote-source-staging/[batchId]/page.tsx");

    expect(existsSync(path.join(root, formPath))).toBe(true);
    expect(form).toContain("credentials: \"same-origin\"");
    expect(form).toContain("/api/finance/quote-source-staging/${batchId}/import-candidate-amounts");
    expect(form).toContain("data-testid=\"finance-candidate-amount-import-form\"");
    expect(form).toContain("data-testid=\"finance-candidate-amount-import-disabled\"");
    expect(form).toContain("候选金额导入暂未开放");
    expect(form).toContain("候选金额不是正式报价");
    expect(form).toContain("候选金额不是 FinanceApprovedPrice");
    expect(form).toContain("导入后默认仅财务可见");
    expect(form).not.toContain("actorUserId");
    expect(form).not.toContain("unknown");

    expect(detail).toContain("FinanceQuoteCandidateValueImportForm");
    expect(detail).toContain("请求必须由当前页面发起");
    expect(detail).toContain("不从前端传 actorUserId");
    expect(page).toContain("isFinanceQuoteCandidateAmountImportEnabled");
    expect(page).toContain("candidateValueImportEnabled");
  });

  it("allows only the supported trade modes and keeps formal quote fields out of the UI result", () => {
    const form = readRepoFile("components/finance-quote-candidate-value-import-form.tsx");

    expect(form).toContain("export_usd");
    expect(form).toContain("domestic_cny");
    expect(form).toContain("selectedTradeModes");
    expect(form).not.toContain("costPrice");
    expect(form).not.toContain("quotePrice");
    expect(form).not.toContain("unitPrice");
    expect(form).not.toContain("financeApprovedPrice");
    expect(form).not.toContain("minimumPrice");
    expect(form).not.toContain("grossMargin");
    expect(form).not.toContain("QuoteDraft");
    expect(form).not.toContain("QuoteDraftLine");
    expect(form).not.toContain("officialQuote");
    expect(form).not.toContain("sentToCustomer");
  });

  it("documents the failed UAT cause and the corrected retry path", () => {
    const docs =
      readRepoFile("docs/quote-draft-candidate-amount-design.md") +
      readRepoFile("docs/quote-source-staging-import-design.md") +
      readRepoFile("docs/quote-draft-roadmap.md") +
      readRepoFile("docs/quote-draft-v1-acceptance.md");

    expect(docs).toContain("009R production UAT");
    expect(docs).toContain("未获得 authenticated super_admin session");
    expect(docs).toContain("不能用无 cookie curl");
    expect(docs).toContain("已登录 `super_admin` 页面");
    expect(docs).toContain("009R-Retry");
  });
});
