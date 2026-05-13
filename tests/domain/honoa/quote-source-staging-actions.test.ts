import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createQuoteSourceStagingBatch,
  createQuoteSourceStagingRows,
  getQuoteSourceStagingBatchById
} from "@/lib/honoa/quote-draft/source-staging-repository";
import type {
  CreateQuoteSourceStagingBatchInput,
  CreateQuoteSourceStagingRowInput
} from "@/lib/honoa/quote-draft/source-staging-repository-types";
import type { AuthUser } from "@/lib/honoa/server/auth";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  prismaRef: {
    current: undefined as PrismaClient | undefined
  }
}));

vi.mock("@/lib/honoa/server/auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser
}));

vi.mock("@/lib/honoa/server/db", () => ({
  get prisma() {
    return mocks.prismaRef.current;
  }
}));

const testDatabaseUrl = process.env.QUOTE_SOURCE_STAGING_REPOSITORY_TEST_DATABASE_URL;
const resolvedTestDatabaseUrl =
  testDatabaseUrl ?? "postgresql://missing@127.0.0.1:1/missing_quote_source_staging_action_test";
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const sourcePrefix = `action-test-${Date.now()}`;

function repositoryOptions() {
  return { databaseUrl: resolvedTestDatabaseUrl };
}

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "super-admin-action-user",
    name: "Super Admin Action User",
    email: "super-admin-action-user@example.test",
    passwordHash: "",
    department: "admin",
    role: "super_admin",
    isActive: true,
    createdByUserId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    lastLoginAt: null,
    permissionKeys: [],
    ...overrides
  };
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

function makeStoredRow(overrides: Partial<ReturnType<typeof makeRowInput>> & { id: string }) {
  return {
    id: overrides.id,
    rowStatus: overrides.rowStatus ?? "candidate",
    visibility: overrides.visibility ?? "finance_only",
    priceCandidateStatus: overrides.priceCandidateStatus ?? "not_finance_approved"
  };
}

function makeFakePrisma(overrides: {
  status?: string;
  rows?: Array<ReturnType<typeof makeStoredRow>>;
} = {}) {
  const state = {
    batch: {
      id: "batch-action-unit",
      sourceFileName: `${sourcePrefix}-unit.xlsx`,
      adapterId: "radiator-cost-2026",
      category: "水箱",
      status: overrides.status ?? "dry_run_passed",
      notes: null as string | null,
      rows: overrides.rows ?? [
        makeStoredRow({ id: "row-candidate-cost", priceCandidateStatus: "cost_candidate_available" }),
        makeStoredRow({ id: "row-candidate-not-approved", priceCandidateStatus: "not_finance_approved" }),
        makeStoredRow({ id: "row-manual", rowStatus: "needs_manual_review" }),
        makeStoredRow({ id: "row-addon", rowStatus: "addon_only" }),
        makeStoredRow({ id: "row-blocked", rowStatus: "blocked", visibility: "internal_risk_only" }),
        makeStoredRow({ id: "row-ignored", rowStatus: "ignored" }),
        makeStoredRow({ id: "row-missing", priceCandidateStatus: "missing" }),
        makeStoredRow({ id: "row-review", priceCandidateStatus: "requires_finance_review" })
      ],
      confirmedByUserId: null as string | null,
      confirmedByName: null as string | null,
      confirmedAt: null as Date | null
    },
    auditLogs: [] as unknown[]
  };

  return {
    state,
    prisma: {
      auditLog: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          state.auditLogs.push(data);
          return data;
        })
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          quoteSourceStagingBatch: {
            findUnique: vi.fn(async () => ({ ...state.batch, rows: state.batch.rows })),
            update: vi.fn(async ({ data }: { data: { status: string; confirmedByUserId?: string; confirmedByName?: string; confirmedAt?: Date; notes?: string } }) => {
              state.batch.status = data.status;
              state.batch.confirmedByUserId = data.confirmedByUserId ?? null;
              state.batch.confirmedByName = data.confirmedByName ?? null;
              state.batch.confirmedAt = data.confirmedAt ?? null;
              state.batch.notes = data.notes ?? state.batch.notes;
              return state.batch;
            })
          },
          quoteSourceStagingRow: {
            updateMany: vi.fn(async ({ where, data }: { where: { id: { in: string[] } }; data: { visibility: string } }) => {
              for (const row of state.batch.rows) {
                if (where.id.in.includes(row.id)) {
                  row.visibility = data.visibility as typeof row.visibility;
                }
              }
              return { count: where.id.in.length };
            }),
            findMany: vi.fn(async () => state.batch.rows)
          }
        })
      )
    }
  };
}

async function loadAction(fakePrisma: unknown) {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://user@127.0.0.1:55432/kingaos_action_unit_test?schema=public");
  mocks.prismaRef.current = fakePrisma as PrismaClient;
  return (await import("@/lib/honoa/quote-draft/source-staging-actions"))
    .confirmQuoteSourceStagingBatchAction;
}

describe("quote source staging confirmation server action boundary", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
    mocks.prismaRef.current = undefined;
  });

  it("allows only super_admin, confirms strict candidates, and writes AuditLog metadata", async () => {
    const fake = makeFakePrisma();
    const action = await loadAction(fake.prisma);
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    const result = await action({
      batchId: fake.state.batch.id,
      confirmationNote: "财务确认结构可作为报价草稿候选数据源。",
      rowVisibilityPolicy: "strict_candidate_only"
    });
    const auditLog = fake.state.auditLogs[0] as {
      action: string;
      entityType: string;
      entityId: string;
      metadata: Record<string, unknown>;
    };

    expect(result.ok).toBe(true);
    expect(result.previousStatus).toBe("dry_run_passed");
    expect(result.nextStatus).toBe("finance_confirmed");
    expect(result.exportDraftCandidateRows).toBe(2);
    expect(fake.state.batch.confirmedByUserId).toBe("super-admin-action-user");
    expect(fake.state.batch.rows.filter((row) => row.visibility === "export_draft_candidate")).toHaveLength(2);
    expect(fake.state.batch.rows.find((row) => row.rowStatus === "needs_manual_review")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(fake.state.batch.rows.find((row) => row.rowStatus === "addon_only")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(fake.state.batch.rows.find((row) => row.rowStatus === "blocked")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(fake.state.batch.rows.find((row) => row.rowStatus === "ignored")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(fake.state.batch.rows.find((row) => row.priceCandidateStatus === "missing")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(
      fake.state.batch.rows.find((row) => row.priceCandidateStatus === "requires_finance_review")?.visibility
    ).not.toBe("export_draft_candidate");
    expect(auditLog.action).toBe("quote_source_staging.finance_confirmed");
    expect(auditLog.entityType).toBe("QuoteSourceStagingBatch");
    expect(auditLog.entityId).toBe(fake.state.batch.id);
    expect(auditLog.metadata.rowVisibilityPolicy).toBe("strict_candidate_only");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("financeApprovedPrice");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("officialQuote");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("sentToCustomer");
    expect(JSON.stringify(result)).not.toContain("amount");
    expect(JSON.stringify(result)).not.toContain("costPrice");
    expect(JSON.stringify(result)).not.toContain("minimumPrice");
    expect(JSON.stringify(result)).not.toContain("grossMargin");
  });

  it("rejects regular admin, export staff, and unauthenticated callers", async () => {
    const fake = makeFakePrisma();
    const action = await loadAction(fake.prisma);

    mocks.requireCurrentUser.mockResolvedValue(makeUser({ id: "admin-user", role: "admin", department: "admin" }));
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockResolvedValue(
      makeUser({ id: "export-staff-user", role: "staff", department: "export" })
    );
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockResolvedValue(
      makeUser({ id: "finance-staff-user", role: "staff", department: "finance" })
    );
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockRejectedValue(new Error("not authenticated"));
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("not authenticated");
  });

  it("rejects include_manual_review before calling the confirmation domain", async () => {
    const fake = makeFakePrisma();
    const action = await loadAction(fake.prisma);
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    await expect(
      action({
        batchId: fake.state.batch.id,
        rowVisibilityPolicy: "include_manual_review" as "strict_candidate_only"
      })
    ).rejects.toThrow("strict_candidate_only");
    expect(fake.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects non-dry-run-passed statuses through the status machine", async () => {
    const statuses = ["draft", "cancelled", "finance_confirmed"] as const;

    for (const status of statuses) {
      const fake = makeFakePrisma({ status });
      const action = await loadAction(fake.prisma);
      mocks.requireCurrentUser.mockResolvedValue(makeUser());

      await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow(
        `Invalid quote source staging status transition: ${status} -> finance_confirmed`
      );
    }
  });
});

describeWithDb("quote source staging confirmation server action local/test DB writes", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolvedTestDatabaseUrl
      }
    }
  });

  let action: typeof import("@/lib/honoa/quote-draft/source-staging-actions").confirmQuoteSourceStagingBatchAction;

  beforeAll(async () => {
    mocks.prismaRef.current = prisma;
    action = (await import("@/lib/honoa/quote-draft/source-staging-actions"))
      .confirmQuoteSourceStagingBatchAction;
    await prisma.auditLog.deleteMany({
      where: { action: "quote_source_staging.finance_confirmed" }
    });
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "action-test-" } }
    });
  });

  beforeEach(() => {
    mocks.requireCurrentUser.mockResolvedValue(makeUser());
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { action: "quote_source_staging.finance_confirmed" }
    });
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "action-test-" } }
    });
    await prisma.$disconnect();
    mocks.prismaRef.current = undefined;
  });

  it("allows super_admin to confirm a dry-run-passed batch and writes AuditLog", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      makeBatchInput({ sourceFileName: `${sourcePrefix}-super-admin.xlsx` }),
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
          priceCandidateStatus: "not_finance_approved"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 3,
          rowStatus: "addon_only"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 4,
          rowStatus: "blocked",
          visibility: "internal_risk_only"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 5,
          rowStatus: "ignored"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 6,
          rowStatus: "needs_manual_review"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 7,
          priceCandidateStatus: "missing"
        }),
        makeRowInput(batch.id, {
          sourceRowNumber: 8,
          priceCandidateStatus: "requires_finance_review"
        })
      ],
      repositoryOptions()
    );

    const result = await action({
      batchId: batch.id,
      confirmationNote: "财务确认结构可作为报价草稿候选数据源。",
      rowVisibilityPolicy: "strict_candidate_only"
    });
    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "quote_source_staging.finance_confirmed",
        entityType: "QuoteSourceStagingBatch",
        entityId: batch.id
      }
    });

    expect(result.ok).toBe(true);
    expect(result.previousStatus).toBe("dry_run_passed");
    expect(result.nextStatus).toBe("finance_confirmed");
    expect(result.exportDraftCandidateRows).toBe(2);
    expect(result.warnings.join(" ")).toContain("仍然不是正式报价");
    expect(found?.status).toBe("finance_confirmed");
    expect(found?.confirmedByUserId).toBe("super-admin-action-user");
    expect(found?.rows.filter((row) => row.visibility === "export_draft_candidate")).toHaveLength(2);
    expect(found?.rows.find((row) => row.rowStatus === "addon_only")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(found?.rows.find((row) => row.rowStatus === "blocked")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(found?.rows.find((row) => row.rowStatus === "ignored")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(found?.rows.find((row) => row.rowStatus === "needs_manual_review")?.visibility).not.toBe(
      "export_draft_candidate"
    );
    expect(auditLog?.action).toBe("quote_source_staging.finance_confirmed");
    expect(JSON.stringify(auditLog?.metadata)).toContain("strict_candidate_only");
    expect(JSON.stringify(auditLog?.metadata)).not.toContain("financeApprovedPrice");
    expect(JSON.stringify(auditLog?.metadata)).not.toContain("officialQuote");
    expect(JSON.stringify(result)).not.toContain("amount");
    expect(JSON.stringify(result)).not.toContain("costPrice");
    expect(JSON.stringify(result)).not.toContain("financeApprovedPrice");
    expect(JSON.stringify(result)).not.toContain("minimumPrice");
    expect(JSON.stringify(result)).not.toContain("grossMargin");
    expect(JSON.stringify(result)).not.toContain("officialQuote");
    expect(JSON.stringify(result)).not.toContain("sentToCustomer");
  });

  it("rejects non-super-admin and unauthenticated users", async () => {
    mocks.requireCurrentUser.mockResolvedValue(makeUser({ id: "admin-user", role: "admin", department: "admin" }));
    await expect(action({ batchId: "batch-mock" })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockResolvedValue(
      makeUser({ id: "export-staff-user", role: "staff", department: "export" })
    );
    await expect(action({ batchId: "batch-mock" })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockRejectedValue(new Error("not authenticated"));
    await expect(action({ batchId: "batch-mock" })).rejects.toThrow("not authenticated");
  });

  it("rejects include_manual_review policy at the server action boundary", async () => {
    await expect(
      action({
        batchId: "batch-mock",
        rowVisibilityPolicy: "include_manual_review" as "strict_candidate_only"
      })
    ).rejects.toThrow("strict_candidate_only");
  });

  it("rejects invalid source batch statuses through the status machine", async () => {
    const statuses: CreateQuoteSourceStagingBatchInput["status"][] = [
      "draft",
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

      await expect(action({ batchId: batch.id })).rejects.toThrow(
        `Invalid quote source staging status transition: ${status} -> finance_confirmed`
      );
    }
  });

  it("cleans action integration rows and audit logs back to zero", async () => {
    await prisma.auditLog.deleteMany({
      where: { action: "quote_source_staging.finance_confirmed" }
    });
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });

    const batchCount = await prisma.quoteSourceStagingBatch.count({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });
    const auditCount = await prisma.auditLog.count({
      where: { action: "quote_source_staging.finance_confirmed" }
    });

    expect(batchCount).toBe(0);
    expect(auditCount).toBe(0);
  });
});
