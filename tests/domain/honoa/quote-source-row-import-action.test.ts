import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createQuoteSourceStagingBatch,
  createQuoteSourceStagingRows,
  FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
} from "@/lib/honoa/quote-draft";
import { isFinanceQuoteSourceRowImportEnabled } from "@/lib/honoa/server/feature-flags";
import { importQuoteSourceRows } from "@/lib/honoa/server/quote-source-row-import";

const testDatabaseUrl = process.env.QUOTE_SOURCE_STAGING_REPOSITORY_TEST_DATABASE_URL;
const resolvedTestDatabaseUrl =
  testDatabaseUrl ?? "postgresql://missing@127.0.0.1:1/missing_quote_source_row_import_action_test";
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const safeDatabaseUrl = "postgresql://user@127.0.0.1:5433/kingaos_test?schema=public";
const productionLikeDatabaseUrl = "postgresql://user@prod-rds.aliyuncs.com:5432/kingaos_prod?schema=public";
const sourcePrefix = `row-import-action-test-${Date.now()}`;

function actor(role: string, department = "finance") {
  return {
    id: `user-${role}-${department}`,
    name: `${role} user`,
    email: `${role}-${department}@example.test`,
    department,
    role,
    isActive: true,
    permissionKeys: []
  } as any;
}

function withEnv<T>(key: string, value: string | undefined, callback: () => T) {
  const previous = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
}

function makeWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["KJ编码", "产品名称", "出口成本报价", "纸箱尺寸", "OEM"],
    ["KJMOCK-COND-IMPORT-001", "Mock import condenser", "MOCK_PRICE", "Mock carton", "OEM-MOCK-IMPORT"],
    ["", "Missing KJ import condenser", "MOCK_PRICE", "", ""]
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "2026年冷凝器成本核算");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch_import_1",
    sourceFileName: "2026冷凝器成本报价表.xls",
    adapterId: "condenser-cost-2026",
    category: "冷凝器",
    submittedByRole: "finance",
    consumerDepartment: "export",
    dryRunDecisionStatus: "manual_review_required",
    status: "dry_run_passed",
    createdByUserId: "creator_1",
    createdByName: "Creator",
    createdAt: new Date("2026-05-14T10:00:00.000Z"),
    confirmedByUserId: null,
    confirmedByName: null,
    confirmedAt: null,
    warnings: [],
    notes: null,
    rows: [],
    ...overrides
  } as any;
}

function makeUpload(overrides: Record<string, unknown> = {}) {
  return {
    id: "upload_import_1",
    sourceFileName: "2026冷凝器成本报价表.xls",
    originalFileName: "2026冷凝器成本报价表.xls",
    fileExt: ".xls",
    mimeType: "application/vnd.ms-excel",
    fileSize: 1024,
    storageProvider: "aliyun_oss",
    storageKey: "quote-source-uploads/2026/file.xls",
    uploadStatus: "uploaded",
    dryRunStatus: "completed",
    dryRunAdapterId: "condenser-cost-2026",
    dryRunCategory: "冷凝器",
    stagingBatchId: "batch_import_1",
    ...overrides
  } as any;
}

function fakeDb(batch: any = makeBatch(), upload: any = makeUpload()) {
  let currentBatch = batch ? { ...batch } : null;
  const createdRows: any[] = [];
  const audits: any[] = [];
  const calls: string[] = [];

  function makeRow(data: any) {
    const row = {
      id: `row_${createdRows.length + 1}`,
      createdAt: new Date("2026-05-14T10:10:00.000Z"),
      updatedAt: new Date("2026-05-14T10:10:00.000Z"),
      ...data
    };
    createdRows.push(row);
    currentBatch = currentBatch ? { ...currentBatch, rows: [...(currentBatch.rows ?? []), { id: row.id }] } : null;
    return row;
  }

  const tx = {
    quoteSourceStagingBatch: {
      findUnique: async () => currentBatch
    },
    quoteSourceStagingRow: {
      create: async ({ data }: any) => {
        calls.push("quoteSourceStagingRow.create");
        return makeRow(data);
      }
    },
    auditLog: {
      create: async ({ data }: any) => {
        calls.push("auditLog.create");
        audits.push(data);
        return data;
      }
    }
  };

  return {
    quoteSourceStagingBatch: {
      findUnique: async () => currentBatch
    },
    quoteSourceUpload: {
      findFirst: async () => upload
    },
    $transaction: async (callback: any) => callback(tx),
    getState: () => ({ batch: currentBatch, createdRows, audits, calls })
  } as any;
}

function importOptions(overrides: Record<string, unknown> = {}) {
  return {
    db: fakeDb(),
    databaseUrl: safeDatabaseUrl,
    rowImportEnabled: true,
    readObjectBuffer: async () => makeWorkbookBuffer(),
    ...overrides
  } as any;
}

function makeRepositoryRow(overrides: Record<string, unknown> = {}) {
  return {
    batchId: "batch_repo_1",
    sourceRowNumber: 1,
    rawKjCode: "KJMOCK-REPO-001",
    standardKjCode: "KJMOCK-REPO-001",
    productNameCandidate: "Mock repository condenser",
    category: "冷凝器",
    tradeMode: "unknown",
    priceCandidateStatus: "cost_candidate_available",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: true,
    hasOemInfo: false,
    visibility: "finance_only",
    rowStatus: "candidate",
    warnings: [],
    ...overrides
  } as any;
}

function fakeRepositoryPrisma() {
  const createdRows: any[] = [];
  return {
    prisma: {
      quoteSourceStagingRow: {
        create: async ({ data }: any) => {
          const row = {
            id: `repo_row_${createdRows.length + 1}`,
            createdAt: new Date("2026-05-15T08:00:00.000Z"),
            updatedAt: new Date("2026-05-15T08:00:00.000Z"),
            ...data
          };
          createdRows.push(row);
          return row;
        }
      }
    } as any,
    createdRows
  };
}

describe("Quote Task 009I quote source row import action", () => {
  it("feature flag is server-only and defaults off", () => {
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT", undefined, isFinanceQuoteSourceRowImportEnabled)).toBe(false);
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT", "false", isFinanceQuoteSourceRowImportEnabled)).toBe(false);
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT", "true", isFinanceQuoteSourceRowImportEnabled)).toBe(true);
  });

  it("rejects when feature flag is false", async () => {
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, {
      ...importOptions(),
      rowImportEnabled: false
    })).rejects.toThrow("暂未开放");
  });

  it("only allows super_admin", async () => {
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions())).resolves.toBeTruthy();
    await expect(importQuoteSourceRows(actor("admin", "admin"), { batchId: "batch_import_1" }, importOptions())).rejects.toThrow("不能执行");
    await expect(importQuoteSourceRows(actor("manager", "export"), { batchId: "batch_import_1" }, importOptions())).rejects.toThrow("不能执行");
    await expect(importQuoteSourceRows(actor("sales", "export"), { batchId: "batch_import_1" }, importOptions())).rejects.toThrow("不能执行");
  });

  it("rejects missing batch", async () => {
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "missing" }, importOptions({
      db: fakeDb(null, makeUpload())
    }))).rejects.toThrow("staging batch 不存在");
  });

  it("rejects invalid batch status, adapter, and category", async () => {
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch({ status: "draft" }), makeUpload())
    }))).rejects.toThrow("dry_run_passed");
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch({ adapterId: "radiator-cost-2026" }), makeUpload())
    }))).rejects.toThrow("condenser-cost-2026");
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch({ category: "水箱" }), makeUpload())
    }))).rejects.toThrow("冷凝器");
  });

  it("rejects duplicate import when rows already exist", async () => {
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch({ rows: [{ id: "existing-row" }] }), makeUpload())
    }))).rejects.toThrow("已有 rows");
  });

  it("imports mock workbook rows as finance_only metadata and writes AuditLog", async () => {
    const db = fakeDb(makeBatch(), makeUpload());
    const result = await importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({ db }));
    const state = db.getState();
    const serializedRows = JSON.stringify(result.rows);
    const serializedAudit = JSON.stringify(state.audits[0]);

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((row: any) => row.visibility === "finance_only")).toBe(true);
    expect(result.rows.map((row: any) => row.visibility)).not.toContain("export_draft_candidate");
    expect(state.audits[0].action).toBe("quote_source_staging.rows_imported");
    expect(state.audits[0].metadata.rowCount).toBe(result.rows.length);
    expect(serializedRows).not.toContain("MOCK_PRICE");
    expect(serializedRows).not.toContain("OEM-MOCK-IMPORT");
    expect(serializedRows).not.toMatch(/amount|unitPrice|costPrice|quotePrice|financeApprovedPrice|minimumPrice|grossMargin|officialQuote|sentToCustomer/i);
    expect(serializedAudit).not.toMatch(/amount|unitPrice|costPrice|quotePrice|financeApprovedPrice|minimumPrice|grossMargin|signedUrl|accessKey/i);
  });

  it("allows the action controlled production path only after all row import guards pass", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const db = fakeDb(makeBatch(), makeUpload());
      const result = await importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
        db,
        databaseUrl: productionLikeDatabaseUrl
      }));
      const state = db.getState();

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((row: any) => row.visibility === "finance_only")).toBe(true);
      expect(result.rows.map((row: any) => row.visibility)).not.toContain("export_draft_candidate");
      expect(state.calls).toContain("quoteSourceStagingRow.create");
      expect(state.audits).toHaveLength(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("validates the linked upload before reading the workbook", async () => {
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch(), null),
      readObjectBuffer: async () => {
        throw new Error("must not read workbook without upload");
      }
    }))).rejects.toThrow("未找到");
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch(), makeUpload({ uploadStatus: "pending" })),
      readObjectBuffer: async () => {
        throw new Error("must not read workbook before upload status check");
      }
    }))).rejects.toThrow("uploaded");
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch(), makeUpload({ dryRunStatus: "not_run" })),
      readObjectBuffer: async () => {
        throw new Error("must not read workbook before dryRunStatus check");
      }
    }))).rejects.toThrow("completed");
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch(), makeUpload({ stagingBatchId: "other_batch" })),
      readObjectBuffer: async () => {
        throw new Error("must not read workbook before stagingBatchId check");
      }
    }))).rejects.toThrow("未关联");
    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db: fakeDb(makeBatch(), makeUpload({ storageKey: "" })),
      readObjectBuffer: async () => {
        throw new Error("must not read workbook before storageKey check");
      }
    }))).rejects.toThrow("storageKey");
  });

  it("does not write rows_imported AuditLog when row creation fails", async () => {
    const db = fakeDb(makeBatch(), makeUpload());

    await expect(importQuoteSourceRows(actor("super_admin", "admin"), { batchId: "batch_import_1" }, importOptions({
      db,
      readObjectBuffer: async () => {
        throw new Error("OSS read failed");
      }
    }))).rejects.toThrow("OSS read failed");

    const state = db.getState();
    expect(state.createdRows).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });
});

describe("Quote Task 009J-Fix controlled production row import repository guard", () => {
  it("keeps the default production write guard closed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { prisma, createdRows } = fakeRepositoryPrisma();

      await expect(createQuoteSourceStagingRows(prisma, "batch_repo_1", [makeRepositoryRow()], {
        databaseUrl: productionLikeDatabaseUrl
      })).rejects.toThrow("disabled in production");
      expect(createdRows).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects controlled production writes when the reason is missing or invalid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const missingReason = fakeRepositoryPrisma();
      const invalidReason = fakeRepositoryPrisma();

      await expect(createQuoteSourceStagingRows(missingReason.prisma, "batch_repo_1", [makeRepositoryRow()], {
        databaseUrl: productionLikeDatabaseUrl,
        allowControlledProductionWrite: true
      })).rejects.toThrow("reason is invalid");
      await expect(createQuoteSourceStagingRows(invalidReason.prisma, "batch_repo_1", [makeRepositoryRow()], {
        databaseUrl: productionLikeDatabaseUrl,
        allowControlledProductionWrite: true,
        productionWriteReason: "wrong_reason" as any
      })).rejects.toThrow("reason is invalid");
      expect(missingReason.createdRows).toHaveLength(0);
      expect(invalidReason.createdRows).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not let the row import production reason bypass other repository writes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { prisma } = fakeRepositoryPrisma();

      await expect(createQuoteSourceStagingBatch(prisma, {
        sourceFileName: "repo-source.xls",
        adapterId: "condenser-cost-2026",
        category: "冷凝器",
        dryRunDecisionStatus: "manual_review_required",
        status: "dry_run_passed"
      }, {
        databaseUrl: productionLikeDatabaseUrl,
        allowControlledProductionWrite: true,
        productionWriteReason: FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
      })).rejects.toThrow("reason is invalid");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows the controlled production row import reason for sanitized finance_only rows", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { prisma, createdRows } = fakeRepositoryPrisma();

      const rows = await createQuoteSourceStagingRows(prisma, "batch_repo_1", [makeRepositoryRow()], {
        databaseUrl: productionLikeDatabaseUrl,
        allowControlledProductionWrite: true,
        productionWriteReason: FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
      });

      expect(rows).toHaveLength(1);
      expect(createdRows).toHaveLength(1);
      expect(rows[0].visibility).toBe("finance_only");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects sensitive fields and export_draft_candidate in the controlled production path", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const sensitive = fakeRepositoryPrisma();
      const exportVisible = fakeRepositoryPrisma();

      await expect(createQuoteSourceStagingRows(sensitive.prisma, "batch_repo_1", [
        makeRepositoryRow({ costPrice: "MOCK_PRICE" })
      ], {
        databaseUrl: productionLikeDatabaseUrl,
        allowControlledProductionWrite: true,
        productionWriteReason: FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
      })).rejects.toThrow("sensitive price field");
      await expect(createQuoteSourceStagingRows(exportVisible.prisma, "batch_repo_1", [
        makeRepositoryRow({ visibility: "export_draft_candidate" })
      ], {
        databaseUrl: productionLikeDatabaseUrl,
        allowControlledProductionWrite: true,
        productionWriteReason: FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
      })).rejects.toThrow("export_draft_candidate");
      expect(sensitive.createdRows).toHaveLength(0);
      expect(exportVisible.createdRows).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describeWithDb("Quote Task 009I row import action local/test DB integration", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolvedTestDatabaseUrl
      }
    }
  });

  beforeAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { action: "quote_source_staging.rows_imported" }
    });
    await prisma.quoteSourceUpload.deleteMany({
      where: { sourceFileName: { startsWith: "row-import-action-test-" } }
    });
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "row-import-action-test-" } }
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { action: "quote_source_staging.rows_imported" }
    });
    await prisma.quoteSourceUpload.deleteMany({
      where: { sourceFileName: { startsWith: "row-import-action-test-" } }
    });
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "row-import-action-test-" } }
    });
    await prisma.$disconnect();
  });

  it("creates rows and AuditLog in local/test DB, then cleans them", async () => {
    const batch = await prisma.quoteSourceStagingBatch.create({
      data: {
        sourceFileName: `${sourcePrefix}-source.xls`,
        adapterId: "condenser-cost-2026",
        category: "冷凝器",
        submittedByRole: "finance",
        consumerDepartment: "export",
        dryRunDecisionStatus: "manual_review_required",
        status: "dry_run_passed",
        warnings: ["009I local/test row import action。"]
      }
    });
    await prisma.quoteSourceUpload.create({
      data: {
        sourceFileName: `${sourcePrefix}-source.xls`,
        originalFileName: `${sourcePrefix}-source.xls`,
        fileExt: ".xls",
        mimeType: "application/vnd.ms-excel",
        fileSize: 1024,
        storageProvider: "aliyun_oss",
        storageKey: "quote-source-uploads/test/source.xls",
        uploadStatus: "uploaded",
        submittedByRole: "finance",
        consumerDepartment: "export",
        stagingBatchId: batch.id,
        uploadedByUserId: "test-uploader",
        uploadedByName: "Test Uploader"
      }
    });

    const result = await importQuoteSourceRows(actor("super_admin", "admin"), { batchId: batch.id }, {
      db: prisma as any,
      databaseUrl: resolvedTestDatabaseUrl,
      rowImportEnabled: true,
      readObjectBuffer: async () => makeWorkbookBuffer()
    });
    const rowCount = await prisma.quoteSourceStagingRow.count({
      where: { batchId: batch.id }
    });
    const auditCount = await prisma.auditLog.count({
      where: {
        action: "quote_source_staging.rows_imported",
        entityId: batch.id
      }
    });
    const rows = await prisma.quoteSourceStagingRow.findMany({
      where: { batchId: batch.id },
      orderBy: { sourceRowNumber: "asc" }
    });

    expect(result.rows.length).toBe(rowCount);
    expect(rowCount).toBeGreaterThan(0);
    expect(auditCount).toBe(1);
    expect(rows.every((row) => row.visibility === "finance_only")).toBe(true);
    expect(rows.map((row) => row.visibility)).not.toContain("export_draft_candidate");

    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });
    await prisma.quoteSourceUpload.deleteMany({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });

    const afterRowCount = await prisma.quoteSourceStagingRow.count({
      where: {
        batch: {
          sourceFileName: { startsWith: sourcePrefix }
        }
      }
    });
    const afterBatchCount = await prisma.quoteSourceStagingBatch.count({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });

    expect(afterRowCount).toBe(0);
    expect(afterBatchCount).toBe(0);
  });
});
