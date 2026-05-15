import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  buildQuoteCandidateAmountImportPlan,
  createQuoteCandidateAmount,
  deleteQuoteCandidateAmountsForTest,
  importQuoteCandidateAmounts
} from "@/lib/honoa/quote-draft";
import type { ImportQuoteCandidateAmountsInput } from "@/lib/honoa/quote-draft";

const BASE_INPUT: ImportQuoteCandidateAmountsInput = {
  stagingBatchId: "candidate-amount-import-test-batch",
  sourceUploadId: "candidate-amount-import-test-upload",
  adapterId: "condenser-cost-2026",
  category: "冷凝器",
  rows: [
    {
      stagingRowId: "candidate-amount-import-test-row-export",
      sourceRowNumber: 8,
      columns: {
        KJ: "KJ-MOCK-001",
        产品名称: "Mock condenser",
        "2026.5.11出口成本报价": "0.0000",
        "2026.4.10出口成本报价": "0.0000"
      }
    },
    {
      stagingRowId: "candidate-amount-import-test-row-domestic",
      sourceRowNumber: 9,
      columns: {
        KJ: "KJ-MOCK-002",
        产品名称: "Mock condenser domestic",
        "2026.5.11出口部内销成本报价": "0.0000"
      }
    }
  ],
  tradeModes: ["export_usd", "domestic_cny", "unknown"],
  importedByUserId: "local-test-user",
  importedByName: "Local Test User"
};

const FORBIDDEN_DTO_FIELDS = [
  "amount",
  "unitPrice",
  "costPrice",
  "quotePrice",
  "minimumPrice",
  "grossMargin",
  "margin",
  "profit",
  "financeApprovedPrice",
  "approvedPrice",
  "officialQuote",
  "sentToCustomer"
];

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)]);
}

function makePlan(input: Partial<ImportQuoteCandidateAmountsInput> = {}) {
  return buildQuoteCandidateAmountImportPlan({
    ...BASE_INPUT,
    ...input
  });
}

describe("Quote Task 009O quote candidate amount importer", () => {
  it("uses the current export USD source column and currency", () => {
    const plan = makePlan({ tradeModes: ["export_usd"] });

    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]).toMatchObject({
      tradeMode: "export_usd",
      currency: "USD",
      sourceColumnName: "2026.5.11出口成本报价",
      sourceColumnDate: "2026.5.11",
      visibility: "finance_only",
      status: "not_finance_approved"
    });
  });

  it("uses the current domestic CNY source column and currency", () => {
    const plan = makePlan({ tradeModes: ["domestic_cny"] });

    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]).toMatchObject({
      stagingRowId: "candidate-amount-import-test-row-domestic",
      tradeMode: "domestic_cny",
      currency: "CNY",
      sourceColumnName: "2026.5.11出口部内销成本报价",
      sourceColumnDate: "2026.5.11",
      visibility: "finance_only",
      status: "not_finance_approved"
    });
  });

  it("does not import unknown trade mode", () => {
    const plan = makePlan({ tradeModes: ["unknown"] });

    expect(plan.candidates).toEqual([]);
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tradeMode: "unknown",
          reason: "requires_finance_review"
        })
      ])
    );
  });

  it("does not import old date source columns as the default candidate", () => {
    const plan = makePlan({
      rows: [
        {
          stagingRowId: "candidate-amount-import-test-row-old-only",
          columns: {
            "2026.4.10出口成本报价": "0.0000"
          }
        }
      ],
      tradeModes: ["export_usd"]
    });

    expect(plan.candidates).toEqual([]);
    expect(plan.skipped[0]).toMatchObject({
      reason: "missing_candidate_value",
      sourceColumnName: "2026.5.11出口成本报价"
    });
  });

  it("keeps importer DTOs free of formal price and customer-sendable fields", () => {
    const plan = makePlan({ tradeModes: ["export_usd", "domestic_cny"] });
    const keys = collectKeys(plan);

    for (const field of FORBIDDEN_DTO_FIELDS) {
      expect(keys).not.toContain(field);
    }
    expect(keys).toContain("candidateValue");
  });

  it("rejects production writes by default before touching Prisma", async () => {
    const prisma = {
      quoteCandidateAmount: {
        findFirst: vi.fn(),
        create: vi.fn()
      }
    };

    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(
        createQuoteCandidateAmount(
          prisma as never,
          {
            stagingBatchId: "batch",
            stagingRowId: "row",
            sourceColumnName: "2026.5.11出口成本报价",
            sourceColumnDate: "2026.5.11",
            tradeMode: "export_usd",
            currency: "USD",
            candidateValue: "0.0000"
          },
          { databaseUrl: "postgresql://user:pass@localhost:5432/kingaos_test?schema=public" }
        )
      ).rejects.toThrow("production");
      expect(prisma.quoteCandidateAmount.findFirst).not.toHaveBeenCalled();
      expect(prisma.quoteCandidateAmount.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("prevents duplicate imports for the same row, trade mode, source column, and date", async () => {
    const existing = {
      id: "existing",
      stagingBatchId: "batch",
      stagingRowId: "row",
      sourceUploadId: "upload",
      sourceColumnName: "2026.5.11出口成本报价",
      sourceColumnDate: "2026.5.11",
      tradeMode: "export_usd",
      currency: "USD",
      candidateValue: { toString: () => "0.0000" },
      source: "finance_quote_source_staging",
      status: "not_finance_approved",
      visibility: "finance_only",
      isFinanceApprovedPrice: false,
      canBeSentToCustomer: false,
      requiresFinancePricing: true,
      importedByUserId: null,
      importedByName: null,
      importedAt: new Date("2026-05-15T00:00:00Z"),
      warnings: [],
      createdAt: new Date("2026-05-15T00:00:00Z"),
      updatedAt: new Date("2026-05-15T00:00:00Z")
    };
    const prisma = {
      quoteCandidateAmount: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn()
      }
    };

    await expect(
      createQuoteCandidateAmount(
        prisma as never,
        {
          stagingBatchId: "batch",
          stagingRowId: "row",
          sourceColumnName: "2026.5.11出口成本报价",
          sourceColumnDate: "2026.5.11",
          tradeMode: "export_usd",
          currency: "USD",
          candidateValue: "0.0000"
        },
        { databaseUrl: "postgresql://user:pass@localhost:5432/kingaos_test?schema=public" }
      )
    ).rejects.toThrow("already imported");
    expect(prisma.quoteCandidateAmount.create).not.toHaveBeenCalled();
  });

  it("does not generate QuoteDraft, QuoteDraftLine, or formal quote outputs", () => {
    const plan = makePlan({ tradeModes: ["export_usd"] });
    const combined = JSON.stringify(plan);

    expect(combined).not.toContain("QuoteDraft");
    expect(combined).not.toContain("QuoteDraftLine");
    expect(combined).not.toContain("formalQuote");
    expect(combined).not.toContain("officialQuote");
  });
});

const dbUrl = process.env.KINGA_CANDIDATE_AMOUNT_TEST_DATABASE_URL;
const runDbTest = dbUrl ? it : it.skip;
let prisma: PrismaClient | undefined;

afterAll(async () => {
  await prisma?.$disconnect();
});

describe("Quote Task 009O quote candidate amount local/test DB integration", () => {
  runDbTest("creates and reads back QuoteCandidateAmount rows, then cleans them up", async () => {
    if (!dbUrl) throw new Error("KINGA_CANDIDATE_AMOUNT_TEST_DATABASE_URL is required for this test");
    const databaseUrl = dbUrl;
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    });
    const options = { databaseUrl };

    await deleteQuoteCandidateAmountsForTest(prisma, { stagingBatchId: BASE_INPUT.stagingBatchId }, options);
    const result = await importQuoteCandidateAmounts(
      prisma,
      {
        ...BASE_INPUT,
        rows: BASE_INPUT.rows.slice(0, 1),
        tradeModes: ["export_usd"]
      },
      options
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      visibility: "finance_only",
      status: "not_finance_approved",
      isFinanceApprovedPrice: false,
      canBeSentToCustomer: false,
      requiresFinancePricing: true
    });
    expect(result.auditMetadata).not.toHaveProperty("candidateValue");

    const stored = await prisma.quoteCandidateAmount.findMany({
      where: { stagingBatchId: BASE_INPUT.stagingBatchId }
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.visibility).toBe("finance_only");
    expect(stored[0]?.status).toBe("not_finance_approved");
    expect(stored[0]?.isFinanceApprovedPrice).toBe(false);
    expect(stored[0]?.canBeSentToCustomer).toBe(false);
    expect(stored[0]?.requiresFinancePricing).toBe(true);

    await expect(
      importQuoteCandidateAmounts(
        prisma,
        {
          ...BASE_INPUT,
          rows: BASE_INPUT.rows.slice(0, 1),
          tradeModes: ["export_usd"]
        },
        options
      )
    ).rejects.toThrow("already imported");

    await deleteQuoteCandidateAmountsForTest(prisma, { stagingBatchId: BASE_INPUT.stagingBatchId }, options);
    await expect(
      prisma.quoteCandidateAmount.count({ where: { stagingBatchId: BASE_INPUT.stagingBatchId } })
    ).resolves.toBe(0);
  });
});
