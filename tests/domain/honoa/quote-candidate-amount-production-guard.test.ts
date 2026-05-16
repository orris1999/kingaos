import { describe, expect, it, vi } from "vitest";
import {
  FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT_UAT_REASON,
  createQuoteCandidateAmount
} from "@/lib/honoa/quote-draft";
import type { CreateQuoteCandidateAmountInput } from "@/lib/honoa/quote-draft";

const SAFE_DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/kingaos_test?schema=public";

function makeInput(overrides: Partial<CreateQuoteCandidateAmountInput> & Record<string, unknown> = {}): CreateQuoteCandidateAmountInput {
  return {
    stagingBatchId: "candidate-amount-production-guard-batch",
    stagingRowId: "candidate-amount-production-guard-row",
    sourceUploadId: "candidate-amount-production-guard-upload",
    sourceColumnName: "2026.5.11出口成本报价",
    sourceColumnDate: "2026.5.11",
    tradeMode: "export_usd",
    currency: "USD",
    candidateValue: "0.0000",
    ...overrides
  };
}

function makePrisma() {
  const created: unknown[] = [];
  return {
    created,
    prisma: {
      quoteCandidateAmount: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          const record = {
            id: "candidate-amount-production-guard-record",
            sourceUploadId: null,
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
            updatedAt: new Date("2026-05-15T00:00:00Z"),
            ...data,
            candidateValue: String(data.candidateValue ?? "0.0000")
          };
          created.push(record);
          return record;
        })
      }
    }
  };
}

describe("Quote Task 009Q candidate amount controlled production guard", () => {
  it("keeps the default production write guard enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { prisma } = makePrisma();

      await expect(
        createQuoteCandidateAmount(prisma as never, makeInput(), { databaseUrl: SAFE_DATABASE_URL })
      ).rejects.toThrow("disabled in production");
      expect(prisma.quoteCandidateAmount.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects production writes without allowControlledProductionWrite", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { prisma } = makePrisma();

      await expect(
        createQuoteCandidateAmount(prisma as never, makeInput(), {
          databaseUrl: SAFE_DATABASE_URL,
          productionWriteReason: FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT_UAT_REASON
        })
      ).rejects.toThrow("disabled in production");
      expect(prisma.quoteCandidateAmount.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects controlled production writes with a mismatched reason", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { prisma } = makePrisma();

      await expect(
        createQuoteCandidateAmount(prisma as never, makeInput(), {
          databaseUrl: SAFE_DATABASE_URL,
          allowControlledProductionWrite: true,
          productionWriteReason: "wrong_reason" as never
        })
      ).rejects.toThrow("reason is invalid");
      expect(prisma.quoteCandidateAmount.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows the explicit candidate amount import UAT reason through to the mock write path", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { prisma, created } = makePrisma();

      const record = await createQuoteCandidateAmount(prisma as never, makeInput(), {
        databaseUrl: SAFE_DATABASE_URL,
        allowControlledProductionWrite: true,
        productionWriteReason: FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT_UAT_REASON
      });

      expect(created).toHaveLength(1);
      expect(record).toMatchObject({
        visibility: "finance_only",
        status: "not_finance_approved",
        isFinanceApprovedPrice: false,
        canBeSentToCustomer: false,
        requiresFinancePricing: true
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects export visibility, formal approval, and customer-sendable boundaries", async () => {
    const { prisma } = makePrisma();
    await expect(
      createQuoteCandidateAmount(
        prisma as never,
        makeInput({ visibility: "export_draft_visible" }),
        { databaseUrl: SAFE_DATABASE_URL }
      )
    ).rejects.toThrow("visibility must be finance_only");

    await expect(
      createQuoteCandidateAmount(
        prisma as never,
        makeInput({ status: "candidate_available" }),
        { databaseUrl: SAFE_DATABASE_URL }
      )
    ).rejects.toThrow("status must be not_finance_approved");

    await expect(
      createQuoteCandidateAmount(
        prisma as never,
        makeInput({ canBeSentToCustomer: true }),
        { databaseUrl: SAFE_DATABASE_URL }
      )
    ).rejects.toThrow("sensitive fields");
  });
});
