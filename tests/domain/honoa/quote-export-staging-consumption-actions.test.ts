import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isExportStagingQuoteDraftEnabled } from "@/lib/honoa/server/feature-flags";
import type { AuthUser } from "@/lib/honoa/server/auth";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  prismaRef: {
    current: undefined as unknown
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
  return readFileSync(relativePath, "utf8");
}

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "super-admin-export-staging-user",
    name: "Super Admin Export Staging User",
    email: "super-admin-export-staging-user@example.test",
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

function makeStoredCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-export-staging-action-1",
    standardKjCode: "KJMOCK-COND-001",
    baseKjCode: "KJMOCK-COND",
    oldKjNo: "OLD-KJMOCK-COND-001",
    productNameCandidate: "Mock condenser",
    category: "冷凝器",
    modelCandidate: "Mock model",
    specificationCandidate: "Mock spec",
    tradeMode: "export_usd",
    priceCandidateStatus: "not_finance_approved",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: false,
    hasOemInfo: false,
    visibility: "export_draft_candidate",
    rowStatus: "candidate",
    warnings: ["mock staging warning"],
    batch: {
      id: "batch-export-staging-action",
      status: "finance_confirmed"
    },
    ...overrides
  };
}

function makeFakePrisma(rows = [makeStoredCandidate()]) {
  return {
    quoteSourceStagingRow: {
      findMany: vi.fn(async () => rows)
    }
  };
}

async function loadAction(fakePrisma: unknown, flagValue = "true") {
  vi.resetModules();
  vi.stubEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", flagValue);
  mocks.prismaRef.current = fakePrisma;
  return (await import("@/lib/honoa/quote-draft/export-staging-consumption-actions"))
    .findExportQuoteDraftSourceCandidatesAction;
}

describe("Quote Task 008C export staging consumption action and feature flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mocks.prismaRef.current = undefined;
  });

  it("feature flag missing or false keeps staging lookup disabled by default", () => {
    vi.stubEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", "");
    expect(isExportStagingQuoteDraftEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", "false");
    expect(isExportStagingQuoteDraftEnabled()).toBe(false);
  });

  it("feature flag true enables the server-side staging lookup branch", () => {
    vi.stubEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", "true");
    expect(isExportStagingQuoteDraftEnabled()).toBe(true);
  });

  it("does not use NEXT_PUBLIC for the export staging quote draft feature flag", () => {
    const flagHelper = readRepoFile("lib/honoa/server/feature-flags.ts");
    const page = readRepoFile("app/export/quote-draft-workbench/page.tsx");

    expect(flagHelper).toContain("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT");
    expect(flagHelper).not.toContain("NEXT_PUBLIC_");
    expect(page).toContain("isExportStagingQuoteDraftEnabled");
    expect(page).not.toContain("NEXT_PUBLIC_");
  });

  it("rejects lookup when the feature flag is false and does not query staging", async () => {
    const fakePrisma = makeFakePrisma();
    const action = await loadAction(fakePrisma, "false");
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    await expect(action({ kjCode: "KJMOCK-COND-001" })).rejects.toThrow("not enabled");
    expect(fakePrisma.quoteSourceStagingRow.findMany).not.toHaveBeenCalled();
  });

  it("allows super_admin to read redacted staging candidates without writing data", async () => {
    const fakePrisma = makeFakePrisma();
    const action = await loadAction(fakePrisma, "true");
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    const result = await action({ kjCode: "KJMOCK-COND-001" });
    const serialized = JSON.stringify(result);

    expect(fakePrisma.quoteSourceStagingRow.findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: "finance_confirmed_staging",
      stagingBatchId: "batch-export-staging-action",
      stagingRowId: "row-export-staging-action-1",
      priceCandidateStatus: "not_finance_approved"
    });
    expect(result[0].warnings.join(" ")).toContain("不是正式报价");
    expect(result[0].warnings.join(" ")).toContain("不是财务批准价格");
    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("grossMargin");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("rejects regular admin, export staff, and unauthenticated callers", async () => {
    const fakePrisma = makeFakePrisma();
    const action = await loadAction(fakePrisma, "true");

    mocks.requireCurrentUser.mockResolvedValue(makeUser({ id: "admin-user", role: "admin", department: "admin" }));
    await expect(action({ kjCode: "KJMOCK-COND-001" })).rejects.toThrow("不能查询");

    mocks.requireCurrentUser.mockResolvedValue(
      makeUser({ id: "export-staff-user", role: "staff", department: "export" })
    );
    await expect(action({ kjCode: "KJMOCK-COND-001" })).rejects.toThrow("不能查询");

    mocks.requireCurrentUser.mockRejectedValue(new Error("not authenticated"));
    await expect(action({ kjCode: "KJMOCK-COND-001" })).rejects.toThrow("not authenticated");
  });

  it("rejects missing KJ and OEM input before returning staging candidates", async () => {
    const fakePrisma = makeFakePrisma();
    const action = await loadAction(fakePrisma, "true");
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    await expect(action({ category: "冷凝器" })).rejects.toThrow("kjCode or normalizedKjCode is required");
    await expect(action({ kjCode: "16400-XXXXX" })).rejects.toThrow("OEM / OE automatic matching is not supported");
  });

  it("filters non-export-visible rows through the repository exposure guard", async () => {
    const fakePrisma = makeFakePrisma([
      makeStoredCandidate({ id: "eligible-row" }),
      makeStoredCandidate({ id: "finance-only-row", visibility: "finance_only" }),
      makeStoredCandidate({ id: "manual-row", rowStatus: "needs_manual_review" }),
      makeStoredCandidate({ id: "missing-row", priceCandidateStatus: "missing" })
    ]);
    const action = await loadAction(fakePrisma, "true");
    mocks.requireCurrentUser.mockResolvedValue(makeUser());

    const result = await action({ kjCode: "KJMOCK-COND-001" });

    expect(result.map((candidate) => candidate.stagingRowId)).toEqual(["eligible-row"]);
  });
});
