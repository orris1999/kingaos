import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isFinanceQuoteSourceDryRunConfirmEnabled } from "@/lib/honoa/server/feature-flags";
import {
  assertCanConfirmQuoteSourceUploadDryRun,
  confirmQuoteSourceUploadDryRun
} from "@/lib/honoa/server/quote-source-upload-dry-run-confirmation";

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

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

function confirmationMigrationSql() {
  const migrationRoot = join(root, "prisma/migrations");
  if (!existsSync(migrationRoot)) return "";
  const migration = readdirSync(migrationRoot)
    .filter((name) => name.includes("add_quote_source_upload_dry_run_confirmation_metadata"))
    .sort()
    .at(-1);
  return migration ? readFileSync(join(migrationRoot, migration, "migration.sql"), "utf8") : "";
}

function confirmableUpload(overrides: Record<string, unknown> = {}) {
  return {
    id: "upload_confirm_1",
    sourceFileName: "2026冷凝器成本报价表.xls",
    originalFileName: "2026冷凝器成本报价表.xls",
    fileExt: ".xls",
    mimeType: "application/vnd.ms-excel",
    fileSize: 1024,
    storageProvider: "aliyun_oss",
    storageKey: "quote-source-uploads/2026/file.xls",
    uploadStatus: "uploaded",
    adapterId: null,
    category: null,
    submittedByRole: "finance",
    consumerDepartment: "export",
    uploadedByUserId: "uploader_1",
    uploadedByName: "Uploader",
    uploadedAt: new Date("2026-05-14T08:00:00.000Z"),
    notes: null,
    warnings: null,
    dryRunStatus: "completed",
    dryRunAdapterId: "condenser-cost-2026",
    dryRunCategory: "冷凝器",
    dryRunSummary: {
      adapterMatch: {
        adapterId: "condenser-cost-2026",
        category: "冷凝器",
        confidence: "high",
        warnings: [],
        unsupportedReasons: []
      },
      dryRunSummary: {
        adapterId: "condenser-cost-2026",
        warnings: [],
        unsupportedReasons: [],
        mappedColumns: {
          kjCode: ["KJ编码"],
          productName: ["产品名称"],
          costPrice: ["出口成本报价"],
          packaging: ["包装"]
        }
      },
      fieldDetection: {
        hasKjColumn: true,
        hasOemOrOeColumn: false,
        hasProductNameColumn: true,
        hasCostCandidateColumn: true,
        hasQuoteCandidateColumn: false,
        hasPackagingColumn: true
      }
    },
    dryRunWarnings: ["dry-run 只做结构识别。"],
    dryRunAt: new Date("2026-05-14T09:00:00.000Z"),
    dryRunByUserId: "super_1",
    dryRunByName: "Super Admin",
    stagingBatchId: null,
    dryRunConfirmedAt: null,
    dryRunConfirmedByUserId: null,
    dryRunConfirmedByName: null,
    createdAt: new Date("2026-05-14T08:00:00.000Z"),
    updatedAt: new Date("2026-05-14T09:00:00.000Z"),
    ...overrides
  } as any;
}

function fakeDb(initialUpload: any) {
  let upload = { ...initialUpload };
  const batches: any[] = [];
  const rows: any[] = [];
  const audits: any[] = [];
  const calls: string[] = [];
  const tx = {
    quoteSourceUpload: {
      findUnique: async () => upload,
      updateMany: async ({ where, data }: any) => {
        calls.push("quoteSourceUpload.updateMany");
        if (where.id !== upload.id || upload.stagingBatchId !== null) return { count: 0 };
        upload = { ...upload, ...data };
        return { count: 1 };
      }
    },
    quoteSourceStagingBatch: {
      create: async ({ data }: any) => {
        calls.push("quoteSourceStagingBatch.create");
        const batch = {
          id: "batch_confirm_1",
          createdAt: new Date("2026-05-14T10:00:00.000Z"),
          confirmedAt: null,
          ...data
        };
        batches.push(batch);
        return batch;
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
    quoteSourceUpload: {
      findUnique: async () => upload
    },
    $transaction: async (callback: any) => callback(tx),
    quoteSourceStagingRow: {
      create: async (row: any) => {
        rows.push(row);
        throw new Error("rows must not be created by dry-run confirmation");
      }
    },
    getState: () => ({ upload, batches, rows, audits, calls })
  } as any;
}

describe("Finance quote source uploaded dry-run confirmation", () => {
  it("feature flag is server-only and defaults off", () => {
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM", undefined, isFinanceQuoteSourceDryRunConfirmEnabled)).toBe(false);
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM", "false", isFinanceQuoteSourceDryRunConfirmEnabled)).toBe(false);
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM", "true", isFinanceQuoteSourceDryRunConfirmEnabled)).toBe(true);
    expect(readRepoFile("lib/honoa/server/feature-flags.ts")).not.toContain("NEXT_PUBLIC_KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM");
  });

  it("only super_admin can confirm uploaded quote source dry-run results", () => {
    expect(() => assertCanConfirmQuoteSourceUploadDryRun(actor("super_admin", "admin"))).not.toThrow();
    expect(() => assertCanConfirmQuoteSourceUploadDryRun(actor("admin", "admin"))).toThrow("不能确认");
    expect(() => assertCanConfirmQuoteSourceUploadDryRun(actor("manager", "export"))).toThrow("不能确认");
    expect(() => assertCanConfirmQuoteSourceUploadDryRun(actor("sales", "export"))).toThrow("不能确认");
  });

  it("creates only QuoteSourceStagingBatch metadata and writes AuditLog", async () => {
    const db = fakeDb(confirmableUpload());
    const result = await confirmQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_confirm_1", {
      db,
      now: () => new Date("2026-05-14T10:00:00.000Z")
    });
    const state = db.getState();
    const batchJson = JSON.stringify(state.batches[0]);
    const auditJson = JSON.stringify(state.audits[0]);

    expect(result.stagingBatch.id).toBe("batch_confirm_1");
    expect(state.calls).toEqual([
      "quoteSourceStagingBatch.create",
      "quoteSourceUpload.updateMany",
      "auditLog.create"
    ]);
    expect(state.batches).toHaveLength(1);
    expect(state.rows).toHaveLength(0);
    expect(state.batches[0].sourceFileName).toBe("2026冷凝器成本报价表.xls");
    expect(state.batches[0].adapterId).toBe("condenser-cost-2026");
    expect(state.batches[0].category).toBe("冷凝器");
    expect(state.batches[0].status).toBe("dry_run_passed");
    expect(state.batches[0].submittedByRole).toBe("finance");
    expect(state.batches[0].consumerDepartment).toBe("export");
    expect(state.upload.stagingBatchId).toBe("batch_confirm_1");
    expect(state.upload.dryRunConfirmedByUserId).toBe("user-super_admin-admin");
    expect(state.audits[0].action).toBe("quote_source_upload.dry_run_confirm");
    expect(auditJson).toContain("stagingBatchId");
    expect(batchJson).not.toMatch(/123\.45|456\.78|KJTEST|OEMTEST/);
    expect(auditJson).not.toMatch(/amount|unitPrice|costPrice|financeApprovedPrice|minimumPrice|grossMargin|officialQuote|signedUrl|accessKey/i);
  });

  it("rejects non-completed or incomplete dry-run metadata", async () => {
    await expect(confirmQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_confirm_1", {
      db: fakeDb(confirmableUpload({ dryRunStatus: "needs_review" }))
    })).rejects.toThrow("completed");

    await expect(confirmQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_confirm_1", {
      db: fakeDb(confirmableUpload({ dryRunAdapterId: null }))
    })).rejects.toThrow("adapterId");

    await expect(confirmQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_confirm_1", {
      db: fakeDb(confirmableUpload({ dryRunCategory: null }))
    })).rejects.toThrow("category");

    await expect(confirmQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_confirm_1", {
      db: fakeDb(confirmableUpload({ dryRunSummary: null }))
    })).rejects.toThrow("结构摘要");
  });

  it("prevents duplicate confirmation for one upload", async () => {
    await expect(confirmQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_confirm_1", {
      db: fakeDb(confirmableUpload({ stagingBatchId: "batch_existing" }))
    })).rejects.toThrow("已经确认");
  });

  it("route and UI are feature gated and do not create rows or quote drafts", () => {
    const route = readRepoFile("app/api/finance/quote-source-upload/[uploadId]/confirm-dry-run/route.ts");
    const page = readRepoFile("app/finance/quote-source-upload/page.tsx");
    const component = readRepoFile("components/finance-quote-source-upload.tsx");
    const server = readRepoFile("lib/honoa/server/quote-source-upload-dry-run-confirmation.ts");
    const combined = [route, page, component, server].join("\n");

    expect(route).toContain("isFinanceQuoteSourceDryRunConfirmEnabled");
    expect(route).toContain("confirmQuoteSourceUploadDryRun");
    expect(page).toContain("dry-run 确认暂未开放");
    expect(component).toContain("dry-run 确认暂未开放");
    expect(component).toContain("/api/finance/quote-source-upload/${uploadId}/confirm-dry-run");
    expect(combined).not.toContain("NEXT_PUBLIC");
    expect(combined).not.toContain("quoteSourceStagingRow.create");
    expect(combined).not.toContain("QuoteDraft");
    expect(combined).not.toContain("QuoteDraftLine");
  });

  it("migration is additive confirmation metadata only", () => {
    const sql = confirmationMigrationSql();

    expect(sql).toContain('ALTER TABLE "QuoteSourceUpload" ADD COLUMN "stagingBatchId"');
    expect(sql).toContain('ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunConfirmedAt"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_stagingBatchId_idx"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_dryRunConfirmedAt_idx"');
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE[\s\S]*\bDROP\b/i);
    expect(sql).not.toMatch(/"(Customer|User|QuoteSourceStagingRow)"/);
    expect(sql).not.toMatch(/amount|unitPrice|costPrice|quotePrice|financeApprovedPrice|minimumPrice|grossMargin|profit|officialQuote/i);
  });
});
