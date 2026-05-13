import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  confirmQuoteSourceStagingBatchForDraftCandidates,
  createQuoteSourceStagingBatch,
  createQuoteSourceStagingRows,
  getQuoteSourceStagingBatchById
} from "@/lib/honoa/quote-draft";
import type {
  ConfirmQuoteSourceStagingBatchInput,
  CreateQuoteSourceStagingBatchInput,
  CreateQuoteSourceStagingRowInput
} from "@/lib/honoa/quote-draft";

const testDatabaseUrl = process.env.QUOTE_SOURCE_STAGING_REPOSITORY_TEST_DATABASE_URL;
const resolvedTestDatabaseUrl =
  testDatabaseUrl ?? "postgresql://missing@127.0.0.1:1/missing_quote_source_staging_confirmation_test";
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const sourcePrefix = `confirmation-test-${Date.now()}`;

function repositoryOptions() {
  return { databaseUrl: resolvedTestDatabaseUrl };
}

function makeBatchInput(
  overrides: Partial<CreateQuoteSourceStagingBatchInput> = {}
): CreateQuoteSourceStagingBatchInput {
  return {
    sourceFileName: `${sourcePrefix}-source.xlsx`,
    adapterId: "radiator-cost-2026",
    category: "水箱",
    dryRunDecisionStatus: "ready_for_staging_design",
    status: "dry_run_passed",
    warnings: ["staging 不是正式价格表。"],
    ...overrides
  };
}

function makeRowInput(
  batchId: string,
  overrides: Partial<CreateQuoteSourceStagingRowInput> = {}
): CreateQuoteSourceStagingRowInput {
  return {
    batchId,
    sourceRowNumber: 1,
    rawKjCode: "KJMOCK-RAD-PA16-A",
    standardKjCode: "KJMOCK-RAD-PA16-A",
    productNameCandidate: "Mock radiator",
    category: "水箱",
    tradeMode: "export_usd",
    priceCandidateStatus: "not_finance_approved",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: true,
    hasOemInfo: false,
    visibility: "finance_only",
    rowStatus: "candidate",
    warnings: ["价格候选不是财务批准价格。"],
    ...overrides
  };
}

function makeConfirmInput(
  batchId: string,
  overrides: Partial<ConfirmQuoteSourceStagingBatchInput> = {}
): ConfirmQuoteSourceStagingBatchInput {
  return {
    batchId,
    actorUserId: "finance-confirmation-user",
    actorName: "Finance Confirmation User",
    confirmationNote: "财务确认该 staging batch 可作为报价草稿候选数据源。",
    ...overrides
  };
}

describe("quote source staging confirmation guard", () => {
  it("rejects production runtime before opening a database connection", async () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      await expect(
        confirmQuoteSourceStagingBatchForDraftCandidates(
          {} as Parameters<typeof confirmQuoteSourceStagingBatchForDraftCandidates>[0],
          makeConfirmInput("batch-mock"),
          { databaseUrl: "postgresql://user@127.0.0.1:55432/kingaos_confirmation_test?schema=public" }
        )
      ).rejects.toThrow("disabled in production");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describeWithDb("quote source staging confirmation local/test DB action", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolvedTestDatabaseUrl
      }
    }
  });

  beforeAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "confirmation-test-" } }
    });
  });

  afterAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "confirmation-test-" } }
    });
    await prisma.$disconnect();
  });

  it("confirms a dry_run_passed batch and promotes only safe candidate rows", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-confirm.xlsx` }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, {
          sourceRowNumber: 1,
          priceCandidateStatus: "cost_candidate_available"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 2,
          priceCandidateStatus: "quote_candidate_available",
          hasCostCandidate: false,
          hasQuoteCandidate: true
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 3,
          priceCandidateStatus: "not_finance_approved"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 4,
          priceCandidateStatus: "missing"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 5,
          priceCandidateStatus: "requires_finance_review"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 6,
          rowStatus: "needs_manual_review",
          warnings: ["基础 KJ 多候选，需要人工确认。"]
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 7,
          rowStatus: "addon_only"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 8,
          rowStatus: "blocked",
          visibility: "internal_risk_only"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 9,
          rowStatus: "ignored"
        })
      ],
      repositoryOptions()
    );

    const result = await confirmQuoteSourceStagingBatchForDraftCandidates(
      prisma,
      makeConfirmInput(batch.id),
      repositoryOptions()
    );
    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());

    expect(result.previousStatus).toBe("dry_run_passed");
    expect(result.nextStatus).toBe("finance_confirmed");
    expect(result.confirmedByUserId).toBe("finance-confirmation-user");
    expect(result.confirmedByName).toBe("Finance Confirmation User");
    expect(result.confirmedAt).toBeTruthy();
    expect(result.exportDraftCandidateRows).toBe(3);
    expect(result.financeOnlyRows).toBe(5);
    expect(result.internalRiskOnlyRows).toBe(1);
    expect(result.addonOnlyRows).toBe(1);
    expect(result.blockedRows).toBe(1);
    expect(result.ignoredRows).toBe(1);
    expect(result.warnings.join(" ")).toContain("仍然不是正式报价");
    expect(result.auditMetadata.previousStatus).toBe("dry_run_passed");
    expect(result.auditMetadata.nextStatus).toBe("finance_confirmed");
    expect(result.auditMetadata.exportDraftCandidateRows).toBe(3);
    expect(found?.status).toBe("finance_confirmed");
    expect(found?.confirmedByUserId).toBe("finance-confirmation-user");
    expect(found?.confirmedAt).toBeTruthy();
    expect(found?.rows).toHaveLength(9);
    expect(
      found?.rows.filter((row) => row.visibility === "export_draft_candidate").map((row) => row.sourceRowNumber)
    ).toEqual([1, 2, 3]);
    expect(found?.rows.find((row) => row.sourceRowNumber === 4)?.visibility).toBe("finance_only");
    expect(found?.rows.find((row) => row.sourceRowNumber === 5)?.visibility).toBe("finance_only");
    expect(found?.rows.find((row) => row.sourceRowNumber === 6)?.visibility).toBe("finance_only");
    expect(found?.rows.find((row) => row.rowStatus === "addon_only")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(found?.rows.find((row) => row.rowStatus === "blocked")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(found?.rows.find((row) => row.rowStatus === "ignored")?.visibility).not.toBe(
      "export_draft_candidate"
    );
  });

  it("rejects direct confirmation from non dry-run-passed statuses", async () => {
    const statuses: CreateQuoteSourceStagingBatchInput["status"][] = [
      "draft",
      "adapter_fix_required",
      "finance_table_fix_required",
      "cancelled",
      "finance_confirmed"
    ];

    for (const status of statuses) {
      const batch = await createQuoteSourceStagingBatch(
        prisma,
        makeBatchInput({
          sourceFileName: `${sourcePrefix}-reject-${status}.xlsx`,
          status,
          confirmedByUserId: status === "finance_confirmed" ? "existing-finance-user" : undefined,
          confirmedByName: status === "finance_confirmed" ? "Existing Finance User" : undefined,
          confirmedAt: status === "finance_confirmed" ? new Date().toISOString() : undefined
        }),
        repositoryOptions()
      );

      await expect(
        confirmQuoteSourceStagingBatchForDraftCandidates(prisma, makeConfirmInput(batch.id), repositoryOptions())
      ).rejects.toThrow(`Invalid quote source staging status transition: ${status} -> finance_confirmed`);
    }
  });

  it("keeps needs_manual_review finance-only under the default strict policy", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-manual-strict.xlsx` }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, {
          sourceRowNumber: 1,
          rowStatus: "needs_manual_review",
          priceCandidateStatus: "not_finance_approved"
        })
      ],
      repositoryOptions()
    );

    const result = await confirmQuoteSourceStagingBatchForDraftCandidates(
      prisma,
      makeConfirmInput(batch.id),
      repositoryOptions()
    );
    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());

    expect(result.exportDraftCandidateRows).toBe(0);
    expect(found?.rows[0].visibility).toBe("finance_only");
  });

  it("can explicitly include manual-review rows without changing addon, blocked, or ignored rows", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-manual-include.xlsx` }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, {
          sourceRowNumber: 1,
          rowStatus: "needs_manual_review",
          priceCandidateStatus: "not_finance_approved"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 2,
          rowStatus: "addon_only"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 3,
          rowStatus: "blocked",
          visibility: "internal_risk_only"
        })
      ],
      repositoryOptions()
    );

    const result = await confirmQuoteSourceStagingBatchForDraftCandidates(
      prisma,
      makeConfirmInput(batch.id, { rowVisibilityPolicy: "include_manual_review" }),
      repositoryOptions()
    );
    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());

    expect(result.exportDraftCandidateRows).toBe(1);
    expect(found?.rows.find((row) => row.sourceRowNumber === 1)?.visibility).toBe(
      "export_draft_candidate"
    );
    expect(found?.rows.find((row) => row.rowStatus === "addon_only")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(found?.rows.find((row) => row.rowStatus === "blocked")?.visibility).not.toBe(
      "export_draft_candidate"
    );
  });

  it("keeps the confirmation result free of formal quote fields", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-formal-field-check.xlsx` }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [makeRowInput(batch.id, { priceCandidateStatus: "not_finance_approved" })],
      repositoryOptions()
    );

    const result = await confirmQuoteSourceStagingBatchForDraftCandidates(
      prisma,
      makeConfirmInput(batch.id),
      repositoryOptions()
    );
    const serialized = JSON.stringify(result);

    expect(result.exportDraftCandidateRows).toBe(1);
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("cleans confirmation integration rows back to zero", async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });

    const batchCount = await prisma.quoteSourceStagingBatch.count({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });
    const rowCount = await prisma.quoteSourceStagingRow.count({
      where: {
        batch: {
          sourceFileName: { startsWith: sourcePrefix }
        }
      }
    });

    expect(batchCount).toBe(0);
    expect(rowCount).toBe(0);
  });
});
