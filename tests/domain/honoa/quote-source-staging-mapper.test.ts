import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  attachQuoteSourceStagingBatchIdToRows,
  createQuoteSourceStagingBatch,
  createQuoteSourceStagingRows,
  getQuoteSourceStagingBatchById,
  mapDryRunDecisionStatusToStagingBatchStatus,
  mapDryRunToQuoteSourceStagingInput
} from "@/lib/honoa/quote-draft";
import type {
  QuoteSourceDryRunToStagingInput,
  QuoteSourceDryRunToStagingRowInput
} from "@/lib/honoa/quote-draft";

const testDatabaseUrl = process.env.QUOTE_SOURCE_STAGING_REPOSITORY_TEST_DATABASE_URL;
const resolvedTestDatabaseUrl =
  testDatabaseUrl ?? "postgresql://missing@127.0.0.1:1/missing_quote_source_staging_mapper_test";
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const sourcePrefix = `mapper-test-${Date.now()}`;

function repositoryOptions() {
  return { databaseUrl: resolvedTestDatabaseUrl };
}

function makeRow(overrides: Partial<QuoteSourceDryRunToStagingRowInput> = {}): QuoteSourceDryRunToStagingRowInput {
  return {
    sourceRowNumber: 1,
    rawKjCode: "KJMOCK-COND-001",
    standardKjCode: "KJMOCK-COND-001",
    productNameCandidate: "Mock condenser",
    category: "冷凝器",
    tradeMode: "export_usd",
    priceCandidateStatus: "cost_candidate_available",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: false,
    hasOemInfo: false,
    visibility: "export_draft_candidate",
    rowStatus: "candidate",
    warnings: ["mock dry-run row"],
    ...overrides
  };
}

function makeInput(overrides: Partial<QuoteSourceDryRunToStagingInput> = {}): QuoteSourceDryRunToStagingInput {
  return {
    sourceFileName: `${sourcePrefix}-source.xlsx`,
    adapterId: "condenser-cost-2026",
    category: "冷凝器",
    dryRunDecisionStatus: "ready_for_staging_design",
    createdByUserId: "finance-mock",
    createdByName: "Finance Mock",
    warnings: ["dry-run 已完成结构识别。"],
    rows: [makeRow()],
    ...overrides
  };
}

describe("quote source dry-run to staging mapper", () => {
  it("maps dry-run decision status to staging batch status", () => {
    expect(mapDryRunDecisionStatusToStagingBatchStatus("ready_for_staging_design")).toBe(
      "dry_run_passed"
    );
    expect(mapDryRunDecisionStatusToStagingBatchStatus("needs_finance_table_fix")).toBe(
      "finance_table_fix_required"
    );
    expect(mapDryRunDecisionStatusToStagingBatchStatus("needs_adapter_fix")).toBe(
      "adapter_fix_required"
    );
    expect(mapDryRunDecisionStatusToStagingBatchStatus("addon_only")).toBe("dry_run_passed");
    expect(mapDryRunDecisionStatusToStagingBatchStatus("blocked")).toBe("cancelled");
    expect(mapDryRunDecisionStatusToStagingBatchStatus("manual_review_required")).toBe(
      "dry_run_passed"
    );
  });

  it("maps ready_for_staging_design to dry_run_passed without finance confirmation", () => {
    const mapped = mapDryRunToQuoteSourceStagingInput(makeInput());

    expect(mapped.batch.status).toBe("dry_run_passed");
    expect(mapped.batch.submittedByRole).toBe("finance");
    expect(mapped.batch.consumerDepartment).toBe("export");
    expect(mapped.rows[0]!.visibility).toBe("finance_only");
    expect(mapped.auditMetadata.batchStatus).toBe("dry_run_passed");
    expect(JSON.stringify(mapped)).not.toContain("finance_confirmed");
  });

  it("keeps candidate rows finance_only during dry-run mapping", () => {
    const mapped = mapDryRunToQuoteSourceStagingInput(
      makeInput({ rows: [makeRow({ visibility: "export_draft_candidate", rowStatus: "candidate" })] })
    );

    expect(mapped.rows[0]!.rowStatus).toBe("candidate");
    expect(mapped.rows[0]!.visibility).toBe("finance_only");
    expect(mapped.rows[0]!.warnings!.join(" ")).toContain("dry-run 阶段不会直接生成");
  });

  it("maps manual_review_required rows to needs_manual_review and finance_only", () => {
    const mapped = mapDryRunToQuoteSourceStagingInput(
      makeInput({ dryRunDecisionStatus: "manual_review_required", rows: [makeRow()] })
    );

    expect(mapped.batch.status).toBe("dry_run_passed");
    expect(mapped.rows[0]!.rowStatus).toBe("needs_manual_review");
    expect(mapped.rows[0]!.visibility).toBe("finance_only");
  });

  it("maps addon_only rows without export visibility", () => {
    const mapped = mapDryRunToQuoteSourceStagingInput(
      makeInput({
        dryRunDecisionStatus: "addon_only",
        category: "特殊包装及其他",
        rows: [makeRow({ rowStatus: "candidate", visibility: "export_draft_candidate" })]
      })
    );

    expect(mapped.batch.status).toBe("dry_run_passed");
    expect(mapped.rows[0]!.rowStatus).toBe("addon_only");
    expect(mapped.rows[0]!.visibility).not.toBe("export_draft_candidate");
  });

  it("maps blocked dry-run to cancelled instead of finance_confirmed", () => {
    const mapped = mapDryRunToQuoteSourceStagingInput(
      makeInput({ dryRunDecisionStatus: "blocked", rows: [makeRow()] })
    );

    expect(mapped.batch.status).toBe("cancelled");
    expect(mapped.batch.status).not.toBe("finance_confirmed");
    expect(mapped.rows[0]!.rowStatus).toBe("blocked");
    expect(mapped.rows[0]!.visibility).not.toBe("export_draft_candidate");
  });

  it("keeps blocked and ignored rows away from export_draft_candidate", () => {
    const mapped = mapDryRunToQuoteSourceStagingInput(
      makeInput({
        rows: [
          makeRow({ rowStatus: "blocked", visibility: "export_draft_candidate" }),
          makeRow({ rowStatus: "ignored", visibility: "export_draft_candidate" })
        ]
      })
    );

    expect(mapped.rows.map((row) => row.visibility)).not.toContain("export_draft_candidate");
    expect(mapped.rows[0]!.visibility).toBe("internal_risk_only");
    expect(mapped.rows[1]!.visibility).toBe("internal_risk_only");
  });

  it("rejects sensitive price fields in mapper input", () => {
    expect(() =>
      mapDryRunToQuoteSourceStagingInput({
        ...makeInput(),
        amount: 100
      } as unknown as QuoteSourceDryRunToStagingInput)
    ).toThrow("staging metadata cannot include sensitive price fields");
    expect(() =>
      mapDryRunToQuoteSourceStagingInput({
        ...makeInput(),
        rows: [{ ...makeRow(), costPrice: 100 } as unknown as QuoteSourceDryRunToStagingRowInput]
      })
    ).toThrow("staging metadata cannot include sensitive price fields");
    expect(() =>
      mapDryRunToQuoteSourceStagingInput({
        ...makeInput(),
        rows: [
          {
            ...makeRow(),
            nested: { financeApprovedPrice: 100 }
          } as unknown as QuoteSourceDryRunToStagingRowInput
        ]
      })
    ).toThrow("staging metadata cannot include sensitive price fields");
  });

  it("does not output formal price or quote fields", () => {
    const serialized = JSON.stringify(mapDryRunToQuoteSourceStagingInput(makeInput()));

    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("grossMargin");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });
});

describeWithDb("quote source dry-run to staging mapper local/test DB integration", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolvedTestDatabaseUrl
      }
    }
  });

  beforeAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "mapper-test-" } }
    });
  });

  afterAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "mapper-test-" } }
    });
    await prisma.$disconnect();
  });

  it("creates a batch and rows from mapped dry-run metadata", async () => {
    const mapped = mapDryRunToQuoteSourceStagingInput(
      makeInput({
        sourceFileName: `${sourcePrefix}-integration.xlsx`,
        rows: [
          makeRow({ sourceRowNumber: 1 }),
          makeRow({
            sourceRowNumber: 2,
            rawKjCode: "KJMOCK-RAD-BASE",
            baseKjCode: "KJMOCK-RAD-BASE",
            standardKjCode: undefined,
            category: "水箱",
            rowStatus: "needs_manual_review",
            visibility: "export_draft_candidate",
            warnings: ["基础 KJ 多候选，需要人工确认。"]
          })
        ]
      })
    );

    const batch = await createQuoteSourceStagingBatch(prisma, mapped.batch, repositoryOptions());
    const createdRows = await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      attachQuoteSourceStagingBatchIdToRows(batch.id, mapped.rows),
      repositoryOptions()
    );
    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());

    expect(batch.status).toBe("dry_run_passed");
    expect(createdRows).toHaveLength(2);
    expect(found?.rows).toHaveLength(2);
    expect(found?.rows.map((row) => row.visibility)).not.toContain("export_draft_candidate");
    expect(found?.rows[1].rowStatus).toBe("needs_manual_review");
  });

  it("cleans mapper integration rows back to zero", async () => {
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
