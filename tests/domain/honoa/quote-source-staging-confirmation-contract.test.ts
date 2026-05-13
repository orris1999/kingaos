import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  QUOTE_SOURCE_STAGING_CONFIRMATION_AUDIT_ACTIONS,
  QUOTE_SOURCE_STAGING_CONFIRMATION_PERMISSION_KEYS,
  QUOTE_SOURCE_STAGING_CONFIRMATION_ROUTES,
  QUOTE_SOURCE_STAGING_CONFIRMATION_ROW_VISIBILITY_POLICIES
} from "@/lib/honoa/quote-draft";
import type {
  CancelQuoteSourceStagingBatchActionInput,
  ConfirmQuoteSourceStagingBatchActionInput,
  ConfirmQuoteSourceStagingBatchActionResult,
  QuoteSourceStagingConfirmationActionAuditMetadata,
  RequestQuoteSourceStagingFixActionInput
} from "@/lib/honoa/quote-draft";

const root = process.cwd();
const contractSource = readFileSync(
  join(root, "lib/honoa/quote-draft/source-staging-confirmation-contract.ts"),
  "utf8"
);
const seed = readFileSync(join(root, "prisma/seed.mjs"), "utf8");
const seedData = readFileSync(join(root, "prisma/seed-data.mjs"), "utf8");

const forbiddenBusinessFields = [
  "amount",
  "costPrice",
  "quotePrice",
  "financeApprovedPrice",
  "approvedPrice",
  "minimumPrice",
  "grossMargin",
  "sentToCustomer",
  "officialQuote"
];

describe("quote source staging confirmation UI/action contract", () => {
  it("documents the future Finance-only routes without creating UI pages", () => {
    expect(QUOTE_SOURCE_STAGING_CONFIRMATION_ROUTES.list).toBe("/finance/quote-source-staging");
    expect(QUOTE_SOURCE_STAGING_CONFIRMATION_ROUTES.detailPattern).toBe(
      "/finance/quote-source-staging/[batchId]"
    );
    expect(existsSync(join(root, "app/finance/quote-source-staging/page.tsx"))).toBe(false);
    expect(existsSync(join(root, "app/finance/quote-source-staging/[batchId]/page.tsx"))).toBe(false);
  });

  it("confirm action input only allows strict_candidate_only", () => {
    const input: ConfirmQuoteSourceStagingBatchActionInput = {
      batchId: "batch-mock",
      confirmationNote: "财务确认可作为草稿候选数据源。",
      rowVisibilityPolicy: "strict_candidate_only"
    };

    const invalidInput: ConfirmQuoteSourceStagingBatchActionInput = {
      batchId: "batch-mock",
      // @ts-expect-error include_manual_review is intentionally excluded from the future action contract.
      rowVisibilityPolicy: "include_manual_review"
    };

    expect(input.rowVisibilityPolicy).toBe("strict_candidate_only");
    expect(QUOTE_SOURCE_STAGING_CONFIRMATION_ROW_VISIBILITY_POLICIES).toEqual([
      "strict_candidate_only"
    ]);
    expect(invalidInput.batchId).toBe("batch-mock");
  });

  it("confirm action result returns counts and warnings without price or formal quote fields", () => {
    const result: ConfirmQuoteSourceStagingBatchActionResult = {
      ok: true,
      batchId: "batch-mock",
      previousStatus: "dry_run_passed",
      nextStatus: "finance_confirmed",
      exportDraftCandidateRows: 3,
      financeOnlyRows: 5,
      internalRiskOnlyRows: 1,
      warnings: [
        "finance_confirmed 不是正式价格。",
        "export_draft_candidate 不是正式报价。"
      ]
    };
    const serialized = JSON.stringify(result);

    expect(result.nextStatus).toBe("finance_confirmed");
    for (const field of forbiddenBusinessFields) {
      expect(serialized).not.toContain(field);
    }
  });

  it("request fix and cancel inputs require reasons", () => {
    const requestFix: RequestQuoteSourceStagingFixActionInput = {
      batchId: "batch-mock",
      reason: "adapter 需要补充列名候选。",
      fixType: "adapter_fix_required"
    };
    const cancel: CancelQuoteSourceStagingBatchActionInput = {
      batchId: "batch-mock",
      reason: "财务取消该 staging 候选。"
    };

    // @ts-expect-error reason is required for request-fix action input.
    const missingFixReason: RequestQuoteSourceStagingFixActionInput = {
      batchId: "batch-mock",
      fixType: "finance_table_fix_required"
    };
    // @ts-expect-error reason is required for cancel action input.
    const missingCancelReason: CancelQuoteSourceStagingBatchActionInput = {
      batchId: "batch-mock"
    };

    expect(requestFix.reason).toContain("adapter");
    expect(cancel.reason).toContain("取消");
    expect(missingFixReason.batchId).toBe("batch-mock");
    expect(missingCancelReason.batchId).toBe("batch-mock");
  });

  it("audit metadata includes row counts and strict visibility policy", () => {
    const metadata: QuoteSourceStagingConfirmationActionAuditMetadata = {
      batchId: "batch-mock",
      sourceFileName: "mock.xlsx",
      adapterId: "radiator-cost-2026",
      category: "水箱",
      previousStatus: "dry_run_passed",
      nextStatus: "finance_confirmed",
      actorUserId: "finance-user",
      actorName: "Finance User",
      confirmationNote: "财务确认结构可进入草稿候选。",
      rowVisibilityPolicy: "strict_candidate_only",
      exportDraftCandidateRows: 3,
      financeOnlyRows: 5,
      internalRiskOnlyRows: 1,
      addonOnlyRows: 1,
      blockedRows: 1,
      ignoredRows: 1
    };

    expect(metadata.rowVisibilityPolicy).toBe("strict_candidate_only");
    expect(metadata.exportDraftCandidateRows).toBe(3);
    expect(metadata.addonOnlyRows).toBe(1);
    expect(QUOTE_SOURCE_STAGING_CONFIRMATION_AUDIT_ACTIONS).toContain(
      "quote_source_staging.confirm"
    );
  });

  it("future permission keys are contract-only and not added to seed", () => {
    expect(QUOTE_SOURCE_STAGING_CONFIRMATION_PERMISSION_KEYS).toEqual([
      "finance.quote_source_staging.view",
      "finance.quote_source_staging.confirm",
      "finance.quote_source_staging.cancel",
      "finance.quote_source_staging.request_fix"
    ]);

    for (const key of QUOTE_SOURCE_STAGING_CONFIRMATION_PERMISSION_KEYS) {
      expect(seed).not.toContain(key);
      expect(seedData).not.toContain(key);
    }
  });

  it("does not add API routes, server actions, or executable action code", () => {
    expect(contractSource).not.toContain('"use server"');
    expect(contractSource).not.toContain("'use server'");
    expect(contractSource).not.toMatch(/export\s+async\s+function/);
    expect(existsSync(join(root, "app/api/finance/quote-source-staging"))).toBe(false);
  });
});
