import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { deleteQuoteCandidateAmountsForTest } from "@/lib/honoa/quote-draft";
import { isFinanceQuoteCandidateAmountImportEnabled } from "@/lib/honoa/server/feature-flags";
import { importQuoteCandidateAmountsForBatch } from "@/lib/honoa/server/quote-candidate-amount-import";
import type { AuthUser } from "@/lib/honoa/server/auth";
import type { QuoteCandidateAmountWorkbookRowLike } from "@/lib/honoa/quote-draft";

const SAFE_DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/kingaos_test?schema=public";
const TEST_BATCH_ID = "candidate-amount-action-test-batch";
const TEST_UPLOAD_ID = "candidate-amount-action-test-upload";

const SUPER_ADMIN: AuthUser = {
  id: "super-admin",
  email: "super@example.test",
  name: "Super Admin",
  passwordHash: "test-password-hash",
  role: "super_admin",
  department: "finance",
  isActive: true,
  createdByUserId: null,
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:00:00.000Z",
  lastLoginAt: null,
  permissionKeys: []
};

const EXPORT_ROW = {
  id: "candidate-amount-action-row-export",
  sourceRowNumber: 8,
  visibility: "export_draft_candidate",
  rowStatus: "candidate",
  priceCandidateStatus: "cost_candidate_available"
};

const DOMESTIC_ROW = {
  id: "candidate-amount-action-row-domestic",
  sourceRowNumber: 9,
  visibility: "export_draft_candidate",
  rowStatus: "candidate",
  priceCandidateStatus: "not_finance_approved"
};

const MANUAL_REVIEW_ROW = {
  id: "candidate-amount-action-row-manual",
  sourceRowNumber: 10,
  visibility: "finance_only",
  rowStatus: "needs_manual_review",
  priceCandidateStatus: "cost_candidate_available"
};

const DEFAULT_WORKBOOK_ROWS: QuoteCandidateAmountWorkbookRowLike[] = [
  {
    stagingRowId: EXPORT_ROW.id,
    sourceRowNumber: EXPORT_ROW.sourceRowNumber,
    columns: {
      KJ: "KJ-MOCK-EXPORT",
      "2026.5.11出口成本报价": "0.0000",
      "2026.4.10出口成本报价": "9999"
    }
  },
  {
    stagingRowId: DOMESTIC_ROW.id,
    sourceRowNumber: DOMESTIC_ROW.sourceRowNumber,
    columns: {
      KJ: "KJ-MOCK-DOMESTIC",
      "2026.5.11出口部内销成本报价": "0.0000"
    }
  },
  {
    stagingRowId: MANUAL_REVIEW_ROW.id,
    sourceRowNumber: MANUAL_REVIEW_ROW.sourceRowNumber,
    columns: {
      KJ: "KJ-MOCK-MANUAL",
      "2026.5.11出口成本报价": "0.0000",
      "2026.5.11出口部内销成本报价": "0.0000"
    }
  }
];

const FORBIDDEN_RESULT_FIELDS = [
  "candidateValue",
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

function makeActor(role: string, department = "finance"): AuthUser {
  return {
    ...SUPER_ADMIN,
    id: `${role}-${department}`,
    role: role as AuthUser["role"],
    department: department as AuthUser["department"]
  };
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BATCH_ID,
    sourceFileName: "mock-condenser.xlsx",
    adapterId: "condenser-cost-2026",
    category: "冷凝器",
    status: "finance_confirmed",
    rows: [EXPORT_ROW, DOMESTIC_ROW, MANUAL_REVIEW_ROW],
    ...overrides
  };
}

function makeUpload(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_UPLOAD_ID,
    sourceFileName: "mock-condenser.xlsx",
    uploadStatus: "uploaded",
    dryRunStatus: "completed",
    stagingBatchId: TEST_BATCH_ID,
    storageKey: "mock-storage-key",
    ...overrides
  };
}

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)]);
}

function makeStoredQuoteCandidateAmount(data: Record<string, unknown>, index: number) {
  return {
    id: `candidate-amount-${index}`,
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
}

function makeDb(options: {
  batch?: ReturnType<typeof makeBatch> | null;
  upload?: ReturnType<typeof makeUpload> | null;
  existing?: unknown;
  useRealCandidateAmountDelegate?: PrismaClient["quoteCandidateAmount"];
} = {}) {
  const created: unknown[] = [];
  const db = {
    quoteSourceStagingBatch: {
      findUnique: vi.fn().mockResolvedValue(options.batch === undefined ? makeBatch() : options.batch)
    },
    quoteSourceUpload: {
      findFirst: vi.fn().mockResolvedValue(options.upload === undefined ? makeUpload() : options.upload)
    },
    quoteCandidateAmount: options.useRealCandidateAmountDelegate ?? {
      findFirst: vi.fn().mockResolvedValue(options.existing ?? null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const stored = makeStoredQuoteCandidateAmount(data, created.length + 1);
        created.push(stored);
        return stored;
      })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-log" })
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db))
  };
  return { db, created };
}

async function runAction(
  overrides: {
    actor?: AuthUser;
    batch?: ReturnType<typeof makeBatch> | null;
    upload?: ReturnType<typeof makeUpload> | null;
    workbookRows?: QuoteCandidateAmountWorkbookRowLike[];
    tradeModes?: Array<"export_usd" | "domestic_cny" | "unknown">;
    importEnabled?: boolean;
    existing?: unknown;
  } = {}
) {
  const { db, created } = makeDb({
    batch: overrides.batch,
    upload: overrides.upload,
    existing: overrides.existing
  });
  const result = await importQuoteCandidateAmountsForBatch(
    overrides.actor ?? SUPER_ADMIN,
    {
      batchId: TEST_BATCH_ID,
      tradeModes: overrides.tradeModes ?? ["export_usd", "domestic_cny"]
    },
    {
      db: db as never,
      databaseUrl: SAFE_DATABASE_URL,
      importEnabled: overrides.importEnabled ?? true,
      workbookRows: overrides.workbookRows ?? DEFAULT_WORKBOOK_ROWS
    }
  );
  return { result, db, created };
}

describe("Quote Task 009P candidate amount import action", () => {
  it("keeps the feature flag closed by default and reads the server-only flag when enabled", () => {
    vi.stubEnv("KINGA_ENABLE_FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT", undefined);
    expect(isFinanceQuoteCandidateAmountImportEnabled()).toBe(false);
    vi.stubEnv("KINGA_ENABLE_FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT", "true");
    expect(isFinanceQuoteCandidateAmountImportEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects when the feature flag is false", async () => {
    await expect(runAction({ importEnabled: false })).rejects.toThrow("暂未开放");
  });

  it("allows only super_admin to import candidate amounts", async () => {
    await expect(runAction({ actor: makeActor("admin") })).rejects.toThrow("不能执行候选金额导入");
    await expect(runAction({ actor: makeActor("manager", "export") })).rejects.toThrow("不能执行候选金额导入");
    await expect(runAction({ actor: makeActor("sales", "export") })).rejects.toThrow("不能执行候选金额导入");

    await expect(runAction({ tradeModes: ["export_usd"] })).resolves.toMatchObject({
      result: expect.objectContaining({ candidateAmountCount: 1 })
    });
  });

  it("rejects missing or unsupported batches", async () => {
    await expect(runAction({ batch: null })).rejects.toThrow("staging batch 不存在");
    await expect(runAction({ batch: makeBatch({ status: "dry_run_passed" }) })).rejects.toThrow("finance_confirmed");
    await expect(runAction({ batch: makeBatch({ adapterId: "radiator-cost-2026" }) })).rejects.toThrow("condenser-cost-2026");
    await expect(runAction({ batch: makeBatch({ category: "水箱" }) })).rejects.toThrow("冷凝器");
  });

  it("requires export_draft_candidate rows and skips needs_manual_review rows", async () => {
    await expect(runAction({ batch: makeBatch({ rows: [MANUAL_REVIEW_ROW] }) })).rejects.toThrow("export_draft_candidate");

    const { result, created } = await runAction({ tradeModes: ["export_usd"] });

    expect(result.candidateAmountCount).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      stagingRowId: EXPORT_ROW.id,
      visibility: "finance_only",
      status: "not_finance_approved"
    });
    expect(JSON.stringify(created)).not.toContain(MANUAL_REVIEW_ROW.id);
  });

  it("requires a completed uploaded quote source upload with storageKey", async () => {
    await expect(runAction({ upload: null })).rejects.toThrow("未找到");
    await expect(runAction({ upload: makeUpload({ uploadStatus: "failed" }) })).rejects.toThrow("uploaded");
    await expect(runAction({ upload: makeUpload({ dryRunStatus: "failed" }) })).rejects.toThrow("completed");
    await expect(runAction({ upload: makeUpload({ stagingBatchId: "other-batch" }) })).rejects.toThrow("未关联");
    await expect(runAction({ upload: makeUpload({ storageKey: "" }) })).rejects.toThrow("storageKey");
  });

  it("imports export USD and domestic CNY current candidate columns only", async () => {
    const { result, created } = await runAction();

    expect(result).toMatchObject({
      candidateAmountCount: 2,
      currencies: ["USD", "CNY"],
      visibility: "finance_only",
      status: "not_finance_approved"
    });
    expect(created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tradeMode: "export_usd",
          currency: "USD",
          sourceColumnName: "2026.5.11出口成本报价",
          sourceColumnDate: "2026.5.11"
        }),
        expect.objectContaining({
          tradeMode: "domestic_cny",
          currency: "CNY",
          sourceColumnName: "2026.5.11出口部内销成本报价",
          sourceColumnDate: "2026.5.11"
        })
      ])
    );
    expect(JSON.stringify(created)).not.toContain("2026.4.10");
  });

  it("rejects unknown trade mode and old-date-only values without writing success audit log", async () => {
    await expect(runAction({ tradeModes: ["unknown"] })).rejects.toThrow("unknown tradeMode");

    const { db } = makeDb();
    await expect(importQuoteCandidateAmountsForBatch(
      SUPER_ADMIN,
      { batchId: TEST_BATCH_ID, tradeModes: ["export_usd"] },
      {
        db: db as never,
        databaseUrl: SAFE_DATABASE_URL,
        importEnabled: true,
        workbookRows: [
          {
            stagingRowId: EXPORT_ROW.id,
            columns: {
              "2026.4.10出口成本报价": "0.0000"
            }
          }
        ]
      }
    )).rejects.toThrow("未识别到可导入的候选金额");
    expect(db.auditLog.create).not.toHaveBeenCalled();

    await expect(runAction({
      tradeModes: ["export_usd"],
      workbookRows: [
        {
          stagingRowId: EXPORT_ROW.id,
          columns: {
            "2026.4.10出口成本报价": "0.0000"
          }
        }
      ]
    })).rejects.toThrow("未识别到可导入的候选金额");
  });

  it("sets fixed finance-only and not-finance-approved boundaries", async () => {
    const { created } = await runAction({ tradeModes: ["export_usd"] });

    expect(created[0]).toMatchObject({
      visibility: "finance_only",
      status: "not_finance_approved",
      isFinanceApprovedPrice: false,
      canBeSentToCustomer: false,
      requiresFinancePricing: true
    });
  });

  it("prevents duplicate imports for the same row and source key", async () => {
    const existing = makeStoredQuoteCandidateAmount(
      {
        stagingBatchId: TEST_BATCH_ID,
        stagingRowId: EXPORT_ROW.id,
        sourceUploadId: TEST_UPLOAD_ID,
        sourceColumnName: "2026.5.11出口成本报价",
        sourceColumnDate: "2026.5.11",
        tradeMode: "export_usd",
        currency: "USD",
        candidateValue: "0.0000"
      },
      1
    );

    await expect(runAction({ tradeModes: ["export_usd"], existing })).rejects.toThrow("already imported");
  });

  it("does not return candidateValue or formal price fields from the action result or audit metadata", async () => {
    const { result, db } = await runAction();
    const auditCall = db.auditLog.create.mock.calls[0]?.[0];
    const keys = [...collectKeys(result), ...collectKeys(auditCall)];

    for (const field of FORBIDDEN_RESULT_FIELDS) {
      expect(keys).not.toContain(field);
    }
  });

  it("does not generate QuoteDraft, QuoteDraftLine, or formal quote outputs", async () => {
    const { result } = await runAction({ tradeModes: ["export_usd"] });
    const combined = JSON.stringify(result);

    expect(combined).not.toContain("QuoteDraft");
    expect(combined).not.toContain("QuoteDraftLine");
    expect(combined).not.toContain("formalQuote");
    expect(combined).not.toContain("officialQuote");
  });

  it("uses the controlled production write option only after action-level checks pass", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { result, db, created } = await runAction({ tradeModes: ["export_usd"] });

      expect(result.candidateAmountCount).toBe(1);
      expect(created).toHaveLength(1);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "quote_candidate_amount.imported",
            metadata: expect.not.objectContaining({
              candidateValue: expect.anything()
            })
          })
        })
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

const dbUrl = process.env.KINGA_CANDIDATE_AMOUNT_TEST_DATABASE_URL;
const runDbTest = dbUrl ? it : it.skip;
let prisma: PrismaClient | undefined;

afterAll(async () => {
  await prisma?.$disconnect();
});

describe("Quote Task 009P candidate amount import action local/test DB integration", () => {
  runDbTest("creates and reads back QuoteCandidateAmount through the action, then cleans up", async () => {
    if (!dbUrl) throw new Error("KINGA_CANDIDATE_AMOUNT_TEST_DATABASE_URL is required for this test");
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl
        }
      }
    });
    const stagingBatchId = `${TEST_BATCH_ID}-db`;
    const rowId = `${EXPORT_ROW.id}-db`;
    const batch = makeBatch({
      id: stagingBatchId,
      rows: [
        {
          ...EXPORT_ROW,
          id: rowId
        }
      ]
    });
    const upload = makeUpload({
      id: `${TEST_UPLOAD_ID}-db`,
      stagingBatchId
    });
    const fakeDb = makeDb({
      batch,
      upload,
      useRealCandidateAmountDelegate: prisma.quoteCandidateAmount
    }).db;

    await deleteQuoteCandidateAmountsForTest(prisma, { stagingBatchId }, { databaseUrl: dbUrl });
    const result = await importQuoteCandidateAmountsForBatch(
      SUPER_ADMIN,
      { batchId: stagingBatchId, tradeModes: ["export_usd"] },
      {
        db: fakeDb as never,
        databaseUrl: dbUrl,
        importEnabled: true,
        workbookRows: [
          {
            stagingRowId: rowId,
            columns: {
              "2026.5.11出口成本报价": "0.0000"
            }
          }
        ]
      }
    );

    expect(result).toMatchObject({
      candidateAmountCount: 1,
      visibility: "finance_only",
      status: "not_finance_approved"
    });
    expect(result).not.toHaveProperty("candidateValue");

    const stored = await prisma.quoteCandidateAmount.findMany({
      where: { stagingBatchId }
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      stagingBatchId,
      stagingRowId: rowId,
      visibility: "finance_only",
      status: "not_finance_approved",
      isFinanceApprovedPrice: false,
      canBeSentToCustomer: false,
      requiresFinancePricing: true
    });

    await deleteQuoteCandidateAmountsForTest(prisma, { stagingBatchId }, { databaseUrl: dbUrl });
    await expect(prisma.quoteCandidateAmount.count({ where: { stagingBatchId } })).resolves.toBe(0);
  });
});
