import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createQuoteSourceStagingBatch,
  createQuoteSourceStagingRows,
  findExportQuoteDraftSourceCandidates
} from "@/lib/honoa/quote-draft";
import type {
  CreateQuoteSourceStagingBatchInput,
  CreateQuoteSourceStagingRowInput
} from "@/lib/honoa/quote-draft";

const testDatabaseUrl = process.env.QUOTE_SOURCE_STAGING_REPOSITORY_TEST_DATABASE_URL;
const resolvedTestDatabaseUrl =
  testDatabaseUrl ?? "postgresql://missing@127.0.0.1:1/missing_quote_export_staging_consumption_test";
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const sourcePrefix = `export-consumption-repository-test-${Date.now()}`;

function repositoryOptions() {
  return { databaseUrl: resolvedTestDatabaseUrl };
}

function makeBatchInput(
  overrides: Partial<CreateQuoteSourceStagingBatchInput> = {}
): CreateQuoteSourceStagingBatchInput {
  return {
    sourceFileName: `${sourcePrefix}-source.xlsx`,
    adapterId: "condenser-cost-2026",
    category: "冷凝器",
    dryRunDecisionStatus: "ready_for_staging_design",
    status: "finance_confirmed",
    confirmedByUserId: "finance-confirmed-user",
    confirmedByName: "Finance Confirmed User",
    confirmedAt: new Date().toISOString(),
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
    rawKjCode: "KJMOCK-COND-001",
    standardKjCode: "KJMOCK-COND-001",
    baseKjCode: "KJMOCK-COND",
    oldKjNo: "OLD-KJMOCK-COND-001",
    productNameCandidate: "Mock condenser",
    category: "冷凝器",
    modelCandidate: "Mock model",
    specificationCandidate: "Mock spec",
    tradeMode: "export_usd",
    priceCandidateStatus: "cost_candidate_available",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: false,
    hasOemInfo: false,
    visibility: "export_draft_candidate",
    rowStatus: "candidate",
    warnings: ["mock staging warning"],
    ...overrides
  };
}

describe("export staging consumption repository input guard", () => {
  it("rejects missing KJ input before querying staging", async () => {
    await expect(
      findExportQuoteDraftSourceCandidates({ quoteSourceStagingRow: {} } as Parameters<
        typeof findExportQuoteDraftSourceCandidates
      >[0], {
        category: "冷凝器"
      })
    ).rejects.toThrow("kjCode or normalizedKjCode is required");
  });

  it("rejects OEM-like input before querying staging", async () => {
    await expect(
      findExportQuoteDraftSourceCandidates({ quoteSourceStagingRow: {} } as Parameters<
        typeof findExportQuoteDraftSourceCandidates
      >[0], {
        kjCode: "16400-XXXXX"
      })
    ).rejects.toThrow("OEM / OE automatic matching is not supported");
  });
});

describeWithDb("export staging consumption repository local/test DB reads", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolvedTestDatabaseUrl
      }
    }
  });

  beforeAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "export-consumption-repository-test-" } }
    });
  });

  afterAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "export-consumption-repository-test-" } }
    });
    await prisma.$disconnect();
  });

  it("returns only finance_confirmed export_draft_candidate candidate rows", async () => {
    const confirmedBatch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-eligible.xlsx` }),
      repositoryOptions()
    );
    const dryRunBatch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({
        sourceFileName: `${sourcePrefix}-dry-run.xlsx`,
        status: "dry_run_passed",
        confirmedByUserId: undefined,
        confirmedByName: undefined,
        confirmedAt: undefined
      }),
      repositoryOptions()
    );

    await createQuoteSourceStagingRows(
      prisma,
      confirmedBatch.id,
      [
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 1 }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 2, visibility: "finance_only" }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 3, visibility: "internal_risk_only" }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 4, rowStatus: "needs_manual_review", visibility: "finance_only" }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 5, rowStatus: "addon_only", visibility: "finance_only" }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 6, rowStatus: "blocked", visibility: "internal_risk_only" }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 7, rowStatus: "ignored", visibility: "internal_risk_only" }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 8, priceCandidateStatus: "missing" }),
        makeRowInput(confirmedBatch.id, { sourceRowNumber: 9, priceCandidateStatus: "requires_finance_review" })
      ],
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      dryRunBatch.id,
      [makeRowInput(dryRunBatch.id, { sourceRowNumber: 1 })],
      repositoryOptions()
    );

    const candidates = await findExportQuoteDraftSourceCandidates(prisma, {
      kjCode: "KJMOCK-COND-001"
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: "finance_confirmed_staging",
      stagingBatchId: confirmedBatch.id,
      standardKjCode: "KJMOCK-COND-001",
      category: "冷凝器",
      priceCandidateStatus: "cost_candidate_available"
    });
    expect(candidates[0].warnings.join(" ")).toContain("不是正式报价");
    expect(candidates[0].warnings.join(" ")).toContain("不是财务批准价格");
  });

  it("allows not_finance_approved as a redacted draft candidate", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({
        sourceFileName: `${sourcePrefix}-not-finance-approved.xlsx`,
        category: "中冷器",
        adapterId: "intercooler-cost-2026"
      }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, {
          sourceRowNumber: 1,
          standardKjCode: "KJMOCK-IC-001",
          baseKjCode: "KJMOCK-IC",
          category: "中冷器",
          tradeMode: "domestic_cny",
          priceCandidateStatus: "not_finance_approved",
          warnings: ["中冷器 mock warning"]
        })
      ],
      repositoryOptions()
    );

    const candidates = await findExportQuoteDraftSourceCandidates(prisma, {
      normalizedKjCode: " KJMOCK-IC-001 ",
      category: "中冷器",
      tradeMode: "domestic_cny"
    });
    const serialized = JSON.stringify(candidates);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].priceCandidateStatus).toBe("not_finance_approved");
    expect(candidates[0].warnings.join(" ")).toContain("多编码、多规格、多包装");
    expect(candidates[0].warnings.join(" ")).toContain("不是正式报价");
    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("grossMargin");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("supports base KJ, old KJ, category, tradeMode, default limit, and max limit", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-filters.xlsx` }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, {
          sourceRowNumber: 1,
          standardKjCode: "KJMOCK-FILTER-001",
          baseKjCode: "KJMOCK-FILTER",
          oldKjNo: "OLD-KJMOCK-FILTER",
          tradeMode: "unknown"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 2,
          standardKjCode: "KJMOCK-FILTER-002",
          baseKjCode: "KJMOCK-FILTER",
          oldKjNo: "OLD-KJMOCK-FILTER",
          tradeMode: "export_usd"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 3,
          standardKjCode: "KJMOCK-FILTER-003",
          baseKjCode: "KJMOCK-FILTER",
          oldKjNo: "OLD-KJMOCK-FILTER",
          tradeMode: "domestic_cny"
        })
      ],
      repositoryOptions()
    );

    const baseMatches = await findExportQuoteDraftSourceCandidates(prisma, {
      normalizedKjCode: "KJMOCK-FILTER",
      category: "冷凝器",
      limit: 120
    });
    const oldCodeMatches = await findExportQuoteDraftSourceCandidates(prisma, {
      kjCode: "OLD-KJMOCK-FILTER",
      tradeMode: "export_usd"
    });
    const noCategoryMatches = await findExportQuoteDraftSourceCandidates(prisma, {
      kjCode: "KJMOCK-FILTER",
      category: "水箱"
    });

    expect(baseMatches).toHaveLength(3);
    expect(baseMatches.length).toBeLessThanOrEqual(50);
    expect(oldCodeMatches.map((candidate) => candidate.tradeMode)).toEqual(["unknown", "export_usd"]);
    expect(noCategoryMatches).toHaveLength(0);
  });

  it("keeps special packaging out of product quote candidates", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({
        sourceFileName: `${sourcePrefix}-packaging.xlsx`,
        adapterId: "special-packaging-2026",
        category: "特殊包装及其他"
      }),
      repositoryOptions()
    );
    await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      [
        makeRowInput(batch.id, {
          sourceRowNumber: 1,
          standardKjCode: "KJMOCK-PACK-001",
          baseKjCode: "KJMOCK-PACK",
          category: "特殊包装及其他",
          rowStatus: "candidate",
          visibility: "export_draft_candidate"
        })
      ],
      repositoryOptions()
    );

    const candidates = await findExportQuoteDraftSourceCandidates(prisma, {
      kjCode: "KJMOCK-PACK-001"
    });

    expect(candidates).toHaveLength(0);
  });

  it("cleans export consumption repository fixtures back to zero", async () => {
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
