import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertNonProductionDatabaseUrl,
  FINANCE_STAGING_CONFIRM_UAT_REASON,
  createQuoteSourceStagingBatch,
  createQuoteSourceStagingRows,
  FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON,
  getQuoteSourceStagingBatchById,
  listQuoteSourceStagingBatches,
  listQuoteSourceStagingRows,
  updateQuoteSourceStagingBatchStatus
} from "@/lib/honoa/quote-draft";
import type {
  CreateQuoteSourceStagingBatchInput,
  CreateQuoteSourceStagingRowInput
} from "@/lib/honoa/quote-draft";

const testDatabaseUrl = process.env.QUOTE_SOURCE_STAGING_REPOSITORY_TEST_DATABASE_URL;
const resolvedTestDatabaseUrl =
  testDatabaseUrl ?? "postgresql://missing@127.0.0.1:1/missing_quote_source_staging_repository_test";
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const sourcePrefix = `repository-test-${Date.now()}`;

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
    visibility: "export_draft_candidate",
    rowStatus: "candidate",
    warnings: ["价格候选不是财务批准价格。"],
    ...overrides
  };
}

describe("Quote source staging repository guard", () => {
  it("rejects missing DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");

    try {
      expect(() => assertNonProductionDatabaseUrl()).toThrow("DATABASE_URL is required");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects production runtime", () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      expect(() =>
        assertNonProductionDatabaseUrl("postgresql://user@127.0.0.1:55432/kingaos_test?schema=public")
      ).toThrow("disabled in production");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps the default production guard while allowing only explicit controlled reasons", () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      expect(() =>
        assertNonProductionDatabaseUrl("postgresql://user@127.0.0.1:55432/kingaos_test?schema=public", {
          allowControlledProductionWrite: true,
          productionWriteReason: FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
        })
      ).toThrow("reason is invalid");
      expect(() =>
        assertNonProductionDatabaseUrl(
          "postgresql://user@127.0.0.1:55432/kingaos_test?schema=public",
          {
            allowControlledProductionWrite: true,
            productionWriteReason: FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
          },
          "quote_source_staging_rows"
        )
      ).not.toThrow();
      expect(() =>
        assertNonProductionDatabaseUrl(
          "postgresql://user@127.0.0.1:55432/kingaos_test?schema=public",
          {
            allowControlledProductionWrite: true,
            productionWriteReason: FINANCE_STAGING_CONFIRM_UAT_REASON
          },
          "quote_source_staging_confirmation"
        )
      ).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects production-like database hosts without printing credentials", () => {
    expect(() =>
      assertNonProductionDatabaseUrl(
        "postgresql://user:secret@pgm-example.pg.rds.aliyuncs.com:5432/kingaos?schema=public"
      )
    ).toThrow("local/test database host");
  });
});

describeWithDb("Quote source staging repository local/test DB writes", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolvedTestDatabaseUrl
      }
    }
  });

  beforeAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "repository-test-" } }
    });
  });

  afterAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "repository-test-" } }
    });
    await prisma.$disconnect();
  });

  it("creates a batch with default finance/export ownership", async () => {
    const batch = await createQuoteSourceStagingBatch(prisma, makeBatchInput(), repositoryOptions());

    expect(batch.submittedByRole).toBe("finance");
    expect(batch.consumerDepartment).toBe("export");
    expect(batch.status).toBe("draft");
    expect(batch.warnings.join(" ")).toContain("不是正式价格表");
  });

  it("creates rows for a batch and reads them back", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-rows.xlsx` }),
      repositoryOptions()
    );
    const rows = await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, { sourceRowNumber: 1 }),
        makeRowInput(batch.id, {
          sourceRowNumber: 2,
          rawKjCode: "KJMOCK-IC-OLD",
          standardKjCode: undefined,
          oldKjNo: "KJMOCK-IC-OLD",
          category: "中冷器",
          visibility: "finance_only",
          rowStatus: "needs_manual_review",
          warnings: ["旧码匹配，需要人工确认。"]
        })
      ],
      repositoryOptions()
    );

    expect(rows).toHaveLength(2);

    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());
    expect(found?.rows).toHaveLength(2);
    expect(found?.rows[0].standardKjCode).toBe("KJMOCK-RAD-PA16-A");
  });

  it("lists batches by status, adapterId, and category", async () => {
    await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({
        sourceFileName: `${sourcePrefix}-filter.xlsx`,
        adapterId: "condenser-cost-2026",
        category: "冷凝器",
        status: "dry_run_passed"
      }),
      repositoryOptions()
    );

    const byStatus = await listQuoteSourceStagingBatches(
      prisma,
      { status: "dry_run_passed" },
      repositoryOptions()
    );
    const byAdapter = await listQuoteSourceStagingBatches(
      prisma,
      { adapterId: "condenser-cost-2026" },
      repositoryOptions()
    );
    const byCategory = await listQuoteSourceStagingBatches(prisma, { category: "冷凝器" }, repositoryOptions());

    expect(byStatus.some((batch) => batch.sourceFileName === `${sourcePrefix}-filter.xlsx`)).toBe(true);
    expect(byAdapter.some((batch) => batch.adapterId === "condenser-cost-2026")).toBe(true);
    expect(byCategory.every((batch) => batch.category === "冷凝器")).toBe(true);
  });

  it("lists rows by rowStatus and visibility", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-row-filter.xlsx` }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, { rowStatus: "candidate", visibility: "export_draft_candidate" }),
        makeRowInput(batch.id, { rowStatus: "needs_manual_review", visibility: "finance_only" })
      ],
      repositoryOptions()
    );

    const manualRows = await listQuoteSourceStagingRows(
      prisma,
      batch.id,
      { rowStatus: "needs_manual_review" },
      repositoryOptions()
    );
    const exportRows = await listQuoteSourceStagingRows(
      prisma,
      batch.id,
      { visibility: "export_draft_candidate" },
      repositoryOptions()
    );

    expect(manualRows).toHaveLength(1);
    expect(manualRows[0].visibility).toBe("finance_only");
    expect(exportRows).toHaveLength(1);
    expect(exportRows[0].rowStatus).toBe("candidate");
  });

  it("rejects submittedByRole values other than finance", async () => {
    await expect(
      createQuoteSourceStagingBatch(
        prisma,
        { ...makeBatchInput(), submittedByRole: "export" as "finance" },
        repositoryOptions()
      )
    ).rejects.toThrow("submittedByRole must be finance");
  });

  it("rejects consumerDepartment values other than export", async () => {
    await expect(
      createQuoteSourceStagingBatch(
        prisma,
        { ...makeBatchInput(), consumerDepartment: "finance" as "export" },
        repositoryOptions()
      )
    ).rejects.toThrow("consumerDepartment must be export");
  });

  it("rejects sensitive price fields in batch and row input", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-sensitive.xlsx` }),
      repositoryOptions()
    );

    await expect(
      createQuoteSourceStagingBatch(
        prisma,
        { ...makeBatchInput(), amount: 100 } as unknown as CreateQuoteSourceStagingBatchInput,
        repositoryOptions()
      )
    ).rejects.toThrow("staging metadata cannot include sensitive price fields");
    await expect(
      createQuoteSourceStagingRows(
        prisma,
        batch.id,
        [{ ...makeRowInput(batch.id), costPrice: 100 } as unknown as CreateQuoteSourceStagingRowInput],
        repositoryOptions()
      )
    ).rejects.toThrow("staging metadata cannot include sensitive price fields");
    await expect(
      createQuoteSourceStagingRows(
        prisma,
        batch.id,
        [
          {
            ...makeRowInput(batch.id),
            nested: { financeApprovedPrice: 100 }
          } as unknown as CreateQuoteSourceStagingRowInput
        ],
        repositoryOptions()
      )
    ).rejects.toThrow("staging metadata cannot include sensitive price fields");
    await expect(
      createQuoteSourceStagingRows(
        prisma,
        batch.id,
        [{ ...makeRowInput(batch.id), minimumPrice: 100 } as unknown as CreateQuoteSourceStagingRowInput],
        repositoryOptions()
      )
    ).rejects.toThrow("staging metadata cannot include sensitive price fields");
    await expect(
      createQuoteSourceStagingRows(
        prisma,
        batch.id,
        [{ ...makeRowInput(batch.id), grossMargin: 30 } as unknown as CreateQuoteSourceStagingRowInput],
        repositoryOptions()
      )
    ).rejects.toThrow("staging metadata cannot include sensitive price fields");
  });

  it("rejects addon_only, blocked, and ignored rows when visibility is export_draft_candidate", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-visibility.xlsx` }),
      repositoryOptions()
    );

    await expect(
      createQuoteSourceStagingRows(
        prisma,
        batch.id,
        [makeRowInput(batch.id, { rowStatus: "addon_only", visibility: "export_draft_candidate" })],
        repositoryOptions()
      )
    ).rejects.toThrow("addon_only rows cannot be export_draft_candidate");
    await expect(
      createQuoteSourceStagingRows(
        prisma,
        batch.id,
        [makeRowInput(batch.id, { rowStatus: "blocked", visibility: "export_draft_candidate" })],
        repositoryOptions()
      )
    ).rejects.toThrow("blocked or ignored rows cannot be export_draft_candidate");
    await expect(
      createQuoteSourceStagingRows(
        prisma,
        batch.id,
        [makeRowInput(batch.id, { rowStatus: "ignored", visibility: "export_draft_candidate" })],
        repositoryOptions()
      )
    ).rejects.toThrow("blocked or ignored rows cannot be export_draft_candidate");
  });

  it("updates batch status without turning it into a formal price", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-status.xlsx` }),
      repositoryOptions()
    );

    await updateQuoteSourceStagingBatchStatus(
      prisma,
      batch.id,
      "dry_run_passed",
      { userId: "finance-mock", name: "Finance Mock" },
      repositoryOptions()
    );
    const updated = await updateQuoteSourceStagingBatchStatus(
      prisma,
      batch.id,
      "finance_confirmed",
      { userId: "finance-mock", name: "Finance Mock" },
      repositoryOptions()
    );
    const serialized = JSON.stringify(updated);

    expect(updated.status).toBe("finance_confirmed");
    expect(updated.confirmedByUserId).toBe("finance-mock");
    expect(updated.confirmedAt).toBeTruthy();
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("rejects invalid status transitions through the repository", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-invalid-transition.xlsx` }),
      repositoryOptions()
    );

    await expect(
      updateQuoteSourceStagingBatchStatus(
        prisma,
        batch.id,
        "finance_confirmed",
        { userId: "finance-mock", name: "Finance Mock" },
        repositoryOptions()
      )
    ).rejects.toThrow("Invalid quote source staging status transition: draft -> finance_confirmed");
  });

  it("allows fix-required statuses to return to dry_run_passed", async () => {
    const adapterBatch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-adapter-fix.xlsx`, status: "dry_run_passed" }),
      repositoryOptions()
    );
    const tableBatch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-table-fix.xlsx`, status: "dry_run_passed" }),
      repositoryOptions()
    );

    const adapterFix = await updateQuoteSourceStagingBatchStatus(
      prisma,
      adapterBatch.id,
      "adapter_fix_required",
      { userId: "tech-mock", name: "Tech Mock" },
      repositoryOptions()
    );
    const tableFix = await updateQuoteSourceStagingBatchStatus(
      prisma,
      tableBatch.id,
      "finance_table_fix_required",
      { userId: "finance-mock", name: "Finance Mock" },
      repositoryOptions()
    );

    expect(adapterFix.status).toBe("adapter_fix_required");
    expect(tableFix.status).toBe("finance_table_fix_required");

    await expect(
      updateQuoteSourceStagingBatchStatus(
        prisma,
        adapterBatch.id,
        "dry_run_passed",
        { userId: "tech-mock", name: "Tech Mock" },
        repositoryOptions()
      )
    ).resolves.toMatchObject({ status: "dry_run_passed" });
    await expect(
      updateQuoteSourceStagingBatchStatus(
        prisma,
        tableBatch.id,
        "dry_run_passed",
        { userId: "finance-mock", name: "Finance Mock" },
        repositoryOptions()
      )
    ).resolves.toMatchObject({ status: "dry_run_passed" });
  });

  it("allows cancellation without deleting batch or rows", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-cancel.xlsx`, status: "dry_run_passed" }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, { rowStatus: "candidate", visibility: "export_draft_candidate" }),
        makeRowInput(batch.id, { rowStatus: "addon_only", visibility: "finance_only", sourceRowNumber: 2 }),
        makeRowInput(batch.id, { rowStatus: "blocked", visibility: "internal_risk_only", sourceRowNumber: 3 }),
        makeRowInput(batch.id, { rowStatus: "ignored", visibility: "finance_only", sourceRowNumber: 4 })
      ],
      repositoryOptions()
    );

    const cancelled = await updateQuoteSourceStagingBatchStatus(
      prisma,
      batch.id,
      "cancelled",
      {
        userId: "finance-mock",
        name: "Finance Mock",
        reason: "财务取消 staging 候选",
        warnings: ["取消后仍保留审计可查的 metadata。"]
      },
      repositoryOptions()
    );
    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.notes).toContain("财务取消");
    expect(cancelled.warnings.join(" ")).toContain("取消后仍保留");
    expect(found?.rows).toHaveLength(4);
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

  it("allows finance_confirmed to move only to cancelled, not backwards", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-confirmed-cancel.xlsx`, status: "dry_run_passed" }),
      repositoryOptions()
    );
    await updateQuoteSourceStagingBatchStatus(
      prisma,
      batch.id,
      "finance_confirmed",
      { userId: "finance-mock", name: "Finance Mock" },
      repositoryOptions()
    );

    await expect(
      updateQuoteSourceStagingBatchStatus(
        prisma,
        batch.id,
        "dry_run_passed",
        { userId: "finance-mock", name: "Finance Mock" },
        repositoryOptions()
      )
    ).rejects.toThrow("Invalid quote source staging status transition: finance_confirmed -> dry_run_passed");
    await expect(
      updateQuoteSourceStagingBatchStatus(
        prisma,
        batch.id,
        "cancelled",
        { userId: "finance-mock", name: "Finance Mock" },
        repositoryOptions()
      )
    ).resolves.toMatchObject({ status: "cancelled" });
  });

  it("does not reactivate cancelled batches", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-cancelled-terminal.xlsx`, status: "dry_run_passed" }),
      repositoryOptions()
    );
    await updateQuoteSourceStagingBatchStatus(
      prisma,
      batch.id,
      "cancelled",
      { userId: "finance-mock", name: "Finance Mock" },
      repositoryOptions()
    );

    await expect(
      updateQuoteSourceStagingBatchStatus(
        prisma,
        batch.id,
        "finance_confirmed",
        { userId: "finance-mock", name: "Finance Mock" },
        repositoryOptions()
      )
    ).rejects.toThrow("Invalid quote source staging status transition: cancelled -> finance_confirmed");
  });

  it("export_draft_candidate row remains a draft candidate, not a formal quote", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-export-draft.xlsx` }),
      repositoryOptions()
    );
    const [row] = await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [makeRowInput(batch.id, { visibility: "export_draft_candidate", rowStatus: "candidate" })],
      repositoryOptions()
    );
    const serialized = JSON.stringify(row);

    expect(row.visibility).toBe("export_draft_candidate");
    expect(row.priceCandidateStatus).toBe("not_finance_approved");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("cleans repository test batches and rows back to zero", async () => {
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
