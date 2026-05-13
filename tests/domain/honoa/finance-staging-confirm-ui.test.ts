import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isFinanceStagingConfirmEnabled } from "@/lib/honoa/server/feature-flags";

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Quote Task 007C Finance staging confirmation UI wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("feature flag missing or false keeps confirmation disabled by default", () => {
    vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "");
    expect(isFinanceStagingConfirmEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "false");
    expect(isFinanceStagingConfirmEnabled()).toBe(false);
  });

  it("feature flag true enables the server-side confirmation branch", () => {
    vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "true");
    expect(isFinanceStagingConfirmEnabled()).toBe(true);
  });

  it("does not use NEXT_PUBLIC for the confirmation feature flag", () => {
    const flagHelper = readRepoFile("lib/honoa/server/feature-flags.ts");
    const detailPage = readRepoFile("app/finance/quote-source-staging/[batchId]/page.tsx");

    expect(flagHelper).toContain("KINGA_ENABLE_FINANCE_STAGING_CONFIRM");
    expect(flagHelper).not.toContain("NEXT_PUBLIC_");
    expect(detailPage).toContain("isFinanceStagingConfirmEnabled");
    expect(detailPage).not.toContain("NEXT_PUBLIC_");
  });

  it("feature flag disabled path renders disabled confirm controls without form submission", () => {
    const form = readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(form).toContain("确认进入草稿候选（暂未开放）");
    expect(form).toContain("当前确认功能未启用。本页仅展示 staging 批次，不执行写入");
    expect(form).toContain("data-testid=\"finance-staging-confirm-disabled\"");
    expect(form).toContain("<button type=\"button\" disabled>确认进入草稿候选（暂未开放）</button>");
  });

  it("feature flag enabled path can call the confirm action with strict_candidate_only only", () => {
    const form = readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(form).toContain("data-testid=\"finance-staging-confirm-form\"");
    expect(form).toContain("confirmQuoteSourceStagingBatchAction");
    expect(form).toContain("rowVisibilityPolicy: \"strict_candidate_only\"");
    expect(form).toContain('name="rowVisibilityPolicy" value="strict_candidate_only"');
    expect(form).not.toContain("include_manual_review");
  });

  it("requires explicit risk confirmation before submit", () => {
    const form = readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(form).toContain("我已确认以上风险，确认进入草稿候选");
    expect(form).toContain('name="riskAcknowledged" required');
    expect(form).toContain("请先确认 staging 风险提示");
    expect(form).toContain("这不是正式报价");
    expect(form).toContain("这不是财务批准价格");
    expect(form).toContain("这不会生成可发客户的报价单");
  });

  it("keeps request-fix and cancel controls disabled", () => {
    const form = readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(form).toContain("退回修正（下一阶段开放）");
    expect(form).toContain("取消批次（下一阶段开放）");
    expect(form).toContain("<button type=\"button\" disabled>退回修正（下一阶段开放）</button>");
    expect(form).toContain("<button type=\"button\" disabled>取消批次（下一阶段开放）</button>");
  });

  it("keeps API routes and Prisma migrations unchanged", () => {
    expect(existsSync(path.join(root, "app/api/finance/quote-source-staging"))).toBe(false);
    expect(existsSync(path.join(root, "prisma/migrations/20260513160000_finance_staging_confirm_ui_wiring"))).toBe(false);
  });

  it("does not show sensitive price fields in the UI wiring", () => {
    const source =
      readRepoFile("components/finance-quote-source-staging-confirm-form.tsx") +
      readRepoFile("components/finance-quote-source-staging-detail.tsx");

    expect(source).not.toContain("amount");
    expect(source).not.toContain("cost" + "Price");
    expect(source).not.toContain("finance" + "ApprovedPrice");
    expect(source).not.toContain("gross" + "Margin");
  });
});
