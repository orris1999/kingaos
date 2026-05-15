import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isFinanceStagingConfirmEnabled } from "@/lib/honoa/server/feature-flags";
import type { AuthUser } from "@/lib/honoa/server/auth";

const root = process.cwd();

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

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "flag-verification-super-admin",
    name: "Flag Verification Super Admin",
    email: "flag-verification-super-admin@example.test",
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

function makeStoredRow({
  id,
  rowStatus = "candidate",
  visibility = "finance_only",
  priceCandidateStatus = "not_finance_approved"
}: {
  id: string;
  rowStatus?: string;
  visibility?: string;
  priceCandidateStatus?: string;
}) {
  return {
    id,
    rowStatus,
    visibility,
    priceCandidateStatus
  };
}

function makeFakePrisma() {
  const state = {
    batch: {
      id: "batch-flag-verification-unit",
      sourceFileName: "flag-verification-mock-source.xlsx",
      adapterId: "radiator-cost-2026",
      category: "水箱",
      status: "dry_run_passed",
      notes: null as string | null,
      rows: [
        makeStoredRow({ id: "row-a-cost", priceCandidateStatus: "cost_candidate_available" }),
        makeStoredRow({ id: "row-b-not-approved", priceCandidateStatus: "not_finance_approved" }),
        makeStoredRow({ id: "row-c-manual", rowStatus: "needs_manual_review" }),
        makeStoredRow({ id: "row-d-addon", rowStatus: "addon_only" }),
        makeStoredRow({ id: "row-e-blocked", rowStatus: "blocked", visibility: "internal_risk_only" }),
        makeStoredRow({ id: "row-f-ignored", rowStatus: "ignored" }),
        makeStoredRow({ id: "row-g-missing", priceCandidateStatus: "missing" }),
        makeStoredRow({ id: "row-h-review", priceCandidateStatus: "requires_finance_review" })
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
            update: vi.fn(
              async ({
                data
              }: {
                data: {
                  status: string;
                  confirmedByUserId?: string;
                  confirmedByName?: string;
                  confirmedAt?: Date;
                  notes?: string;
                };
              }) => {
                state.batch.status = data.status;
                state.batch.confirmedByUserId = data.confirmedByUserId ?? null;
                state.batch.confirmedByName = data.confirmedByName ?? null;
                state.batch.confirmedAt = data.confirmedAt ?? null;
                state.batch.notes = data.notes ?? state.batch.notes;
                return state.batch;
              }
            )
          },
          quoteSourceStagingRow: {
            updateMany: vi.fn(
              async ({
                where,
                data
              }: {
                where: { id: { in: string[] } };
                data: { visibility: string };
              }) => {
                for (const row of state.batch.rows) {
                  if (where.id.in.includes(row.id)) {
                    row.visibility = data.visibility;
                  }
                }
                return { count: where.id.in.length };
              }
            ),
            findMany: vi.fn(async () => state.batch.rows)
          }
        })
      )
    }
  };
}

async function loadAction(fakePrisma: unknown) {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://user@127.0.0.1:55432/kingaos_flag_verify_test?schema=public");
  vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "true");
  mocks.prismaRef.current = fakePrisma as PrismaClient;
  return (await import("@/lib/honoa/quote-draft/source-staging-actions"))
    .confirmQuoteSourceStagingBatchAction;
}

describe("Quote Task 007D Finance staging confirmation feature flag verification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.prismaRef.current = undefined;
    mocks.requireCurrentUser.mockReset();
  });

  it("keeps the confirmation feature disabled when the server flag is missing or false", () => {
    vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "");
    expect(isFinanceStagingConfirmEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "false");
    expect(isFinanceStagingConfirmEnabled()).toBe(false);
  });

  it("enables the confirmation feature only when the server flag is true", () => {
    vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "true");
    expect(isFinanceStagingConfirmEnabled()).toBe(true);
  });

  it("does not use NEXT_PUBLIC and does not expose the flag in the client-facing form", () => {
    const helper = readRepoFile("lib/honoa/server/feature-flags.ts");
    const page = readRepoFile("app/finance/quote-source-staging/[batchId]/page.tsx");
    const form = readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(helper).toContain("KINGA_ENABLE_FINANCE_STAGING_CONFIRM");
    expect(helper).not.toContain("NEXT_PUBLIC_");
    expect(page).toContain("isFinanceStagingConfirmEnabled");
    expect(page).not.toContain("NEXT_PUBLIC_");
    expect(form).not.toContain("KINGA_ENABLE_FINANCE_STAGING_CONFIRM");
    expect(form).not.toContain("NEXT_PUBLIC_");
  });

  it("does not render a submit form or call the action while the flag is disabled", () => {
    const form = readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");
    const disabledBranch = form.slice(form.indexOf("if (!enabled)"), form.indexOf("if (!canSubmit)"));

    expect(disabledBranch).toContain("确认进入草稿候选（暂未开放）");
    expect(disabledBranch).toContain("当前确认功能未启用");
    expect(disabledBranch).not.toContain("<form");
    expect(disabledBranch).not.toContain("confirmQuoteSourceStagingBatchAction");
  });

  it("renders a strict-candidate-only form when the flag is enabled", () => {
    const form = readRepoFile("components/finance-quote-source-staging-confirm-form.tsx");

    expect(form).toContain("data-testid=\"finance-staging-confirm-form\"");
    expect(form).toContain('name="rowVisibilityPolicy" value="strict_candidate_only"');
    expect(form).toContain("rowVisibilityPolicy: \"strict_candidate_only\"");
    expect(form).not.toContain("include_manual_review");
    expect(form).toContain("这不是正式报价。");
    expect(form).toContain("这不是财务批准价格。");
    expect(form).toContain("退回修正（下一阶段开放）");
    expect(form).toContain("取消批次（下一阶段开放）");
  });

  it("lets super_admin confirm mock staging rows and promotes only safe candidate rows", async () => {
    const fake = makeFakePrisma();
    const action = await loadAction(fake.prisma);
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    const result = await action({
      batchId: fake.state.batch.id,
      confirmationNote: "007D 本地测试确认。",
      rowVisibilityPolicy: "strict_candidate_only"
    });
    const auditLog = fake.state.auditLogs[0] as {
      action: string;
      metadata: Record<string, unknown>;
    };

    expect(result.ok).toBe(true);
    expect(result.previousStatus).toBe("dry_run_passed");
    expect(result.nextStatus).toBe("finance_confirmed");
    expect(fake.state.batch.status).toBe("finance_confirmed");
    expect(fake.state.batch.confirmedByUserId).toBe("flag-verification-super-admin");
    expect(fake.state.batch.confirmedByName).toBe("Flag Verification Super Admin");
    expect(fake.state.batch.confirmedAt).toBeTruthy();
    expect(fake.state.batch.rows.find((row) => row.id === "row-a-cost")?.visibility).toBe(
      "export_draft_candidate"
    );
    expect(fake.state.batch.rows.find((row) => row.id === "row-b-not-approved")?.visibility).toBe(
      "export_draft_candidate"
    );
    expect(fake.state.batch.rows.find((row) => row.id === "row-c-manual")?.visibility).toBe("finance_only");
    expect(fake.state.batch.rows.find((row) => row.id === "row-d-addon")?.visibility).toBe("finance_only");
    expect(fake.state.batch.rows.find((row) => row.id === "row-e-blocked")?.visibility).toBe(
      "internal_risk_only"
    );
    expect(fake.state.batch.rows.find((row) => row.id === "row-f-ignored")?.visibility).toBe("finance_only");
    expect(fake.state.batch.rows.find((row) => row.id === "row-g-missing")?.visibility).toBe("finance_only");
    expect(fake.state.batch.rows.find((row) => row.id === "row-h-review")?.visibility).toBe("finance_only");
    expect(result.warnings.join(" ")).toContain("仍然不是正式报价");
    expect(auditLog.action).toBe("quote_source_staging.finance_confirmed");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("amount");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("costPrice");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("financeApprovedPrice");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("officialQuote");
    expect(JSON.stringify(auditLog.metadata)).not.toContain("sentToCustomer");
  });

  it("server action rejects while the feature flag is false", async () => {
    const fake = makeFakePrisma();
    const action = await loadAction(fake.prisma);
    vi.stubEnv("KINGA_ENABLE_FINANCE_STAGING_CONFIRM", "false");
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("not enabled");
    expect(fake.prisma.$transaction).not.toHaveBeenCalled();
    expect(fake.state.auditLogs).toHaveLength(0);
  });

  it("rejects regular admin, finance staff, export users, unauthenticated callers, and include_manual_review", async () => {
    const fake = makeFakePrisma();
    const action = await loadAction(fake.prisma);

    mocks.requireCurrentUser.mockResolvedValue(makeUser({ id: "admin-user", role: "admin", department: "admin" }));
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockResolvedValue(
      makeUser({ id: "finance-staff-user", role: "staff", department: "finance" })
    );
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockResolvedValue(
      makeUser({ id: "export-staff-user", role: "staff", department: "export" })
    );
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("不能确认");

    mocks.requireCurrentUser.mockRejectedValue(new Error("not authenticated"));
    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("not authenticated");

    mocks.requireCurrentUser.mockResolvedValue(makeUser());
    await expect(
      action({
        batchId: fake.state.batch.id,
        rowVisibilityPolicy: "include_manual_review" as "strict_candidate_only"
      })
    ).rejects.toThrow("strict_candidate_only");
  });

  it("keeps production confirmation constrained to the controlled condenser path", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fake = makeFakePrisma();
    const action = await loadAction(fake.prisma);
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    await expect(action({ batchId: fake.state.batch.id })).rejects.toThrow("only supports condenser-cost-2026");
    expect(fake.state.batch.status).toBe("dry_run_passed");
    expect(fake.state.auditLogs).toHaveLength(0);
  });
});
