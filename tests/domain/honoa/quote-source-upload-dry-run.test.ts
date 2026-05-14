import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isFinanceQuoteSourceDryRunEnabled
} from "@/lib/honoa/server/feature-flags";
import {
  assertCanRunQuoteSourceUploadDryRun,
  createQuoteSourceUploadDryRunMetadataFromBuffer,
  runQuoteSourceUploadDryRun
} from "@/lib/honoa/server/quote-source-upload-dry-run";

const XLSX = require("xlsx") as typeof import("xlsx");
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

function workbookBuffer() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["KJ编码", "产品名称", "OEM", "出口成本报价", "报价", "包装", "备注"],
    ["KJTEST001", "测试产品", "OEMTEST001", 123.45, 456.78, "Box", "真实行内容不应保存"]
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "2026年冷凝器成本核算");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function dryRunMigrationSql() {
  const migrationRoot = join(root, "prisma/migrations");
  if (!existsSync(migrationRoot)) return "";
  const migration = readdirSync(migrationRoot)
    .filter((name) => name.includes("add_quote_source_upload_dry_run_metadata"))
    .sort()
    .at(-1);
  return migration ? readFileSync(join(migrationRoot, migration, "migration.sql"), "utf8") : "";
}

describe("Finance uploaded quote source dry-run", () => {
  it("feature flag is server-only and defaults off", () => {
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN", undefined, isFinanceQuoteSourceDryRunEnabled)).toBe(false);
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN", "false", isFinanceQuoteSourceDryRunEnabled)).toBe(false);
    expect(withEnv("KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN", "true", isFinanceQuoteSourceDryRunEnabled)).toBe(true);
    expect(readRepoFile("lib/honoa/server/feature-flags.ts")).not.toContain("NEXT_PUBLIC_KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN");
  });

  it("only super_admin can run uploaded quote source dry-run", () => {
    expect(() => assertCanRunQuoteSourceUploadDryRun(actor("super_admin", "admin"))).not.toThrow();
    expect(() => assertCanRunQuoteSourceUploadDryRun(actor("admin", "admin"))).toThrow("不能执行");
    expect(() => assertCanRunQuoteSourceUploadDryRun(actor("manager", "export"))).toThrow("不能执行");
    expect(() => assertCanRunQuoteSourceUploadDryRun(actor("sales", "export"))).toThrow("不能执行");
  });

  it("extracts only workbook metadata, sheets, headers, mappedColumns and warnings", () => {
    const dryRun = createQuoteSourceUploadDryRunMetadataFromBuffer("2026冷凝器成本报价表.xlsx", workbookBuffer());
    const serialized = JSON.stringify(dryRun);

    expect(dryRun.adapterMatch.adapterId).toBe("condenser-cost-2026");
    expect(dryRun.sheetCount).toBe(1);
    expect(dryRun.workbookMetadata.detectedSheets).toEqual(["2026年冷凝器成本核算"]);
    expect(dryRun.sheetSummaries[0].headerCandidates).toEqual(
      expect.arrayContaining(["KJ编码", "产品名称", "OEM", "出口成本报价", "报价", "包装", "备注"])
    );
    expect(dryRun.dryRunSummary.mappedColumns.kjCode).toContain("KJ编码");
    expect(dryRun.fieldDetection.hasKjColumn).toBe(true);
    expect(dryRun.fieldDetection.hasOemOrOeColumn).toBe(true);
    expect(dryRun.fieldDetection.hasCostCandidateColumn).toBe(true);
    expect(dryRun.fieldDetection.hasQuoteCandidateColumn).toBe(true);
    expect(serialized).not.toContain("123.45");
    expect(serialized).not.toContain("456.78");
    expect(serialized).not.toContain("KJTEST001");
    expect(serialized).not.toContain("OEMTEST001");
    expect(serialized).not.toContain("真实行内容不应保存");
    expect(dryRun.sideEffects.writesStagingBatch).toBe(false);
    expect(dryRun.sideEffects.writesStagingRows).toBe(false);
    expect(dryRun.sideEffects.generatesQuoteDraft).toBe(false);
    expect(dryRun.sideEffects.generatesOfficialQuote).toBe(false);
  });

  it("updates only QuoteSourceUpload dry-run metadata and writes AuditLog", async () => {
    const calls: string[] = [];
    const updateData: Record<string, unknown>[] = [];
    const auditData: Record<string, unknown>[] = [];
    const fakeDb = {
      quoteSourceUpload: {
        findUnique: async () => ({
          id: "upload_1",
          sourceFileName: "2026冷凝器成本报价表.xlsx",
          storageKey: "quote-source-uploads/2026/upload.xlsx",
          uploadStatus: "uploaded"
        })
      },
      $transaction: async (callback: any) => callback({
        quoteSourceUpload: {
          update: async ({ data }: any) => {
            calls.push("quoteSourceUpload.update");
            updateData.push(data);
            return {
              id: "upload_1",
              sourceFileName: "2026冷凝器成本报价表.xlsx",
              storageKey: "quote-source-uploads/2026/upload.xlsx",
              uploadStatus: "uploaded",
              ...data
            };
          }
        },
        auditLog: {
          create: async ({ data }: any) => {
            calls.push("auditLog.create");
            auditData.push(data);
            return data;
          }
        }
      })
    } as any;

    const result = await runQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_1", {
      db: fakeDb,
      readObjectBuffer: async () => workbookBuffer(),
      now: () => new Date("2026-05-14T09:30:00.000Z")
    });
    const updateJson = JSON.stringify(updateData[0]);
    const auditJson = JSON.stringify(auditData[0]);

    expect(calls).toEqual(["quoteSourceUpload.update", "auditLog.create"]);
    expect(result.dryRun.adapterMatch.adapterId).toBe("condenser-cost-2026");
    expect(updateData[0].dryRunStatus).toBe("completed");
    expect(updateData[0].dryRunAdapterId).toBe("condenser-cost-2026");
    expect(updateData[0].dryRunCategory).toBe("冷凝器");
    expect(auditData[0].action).toBe("quote_source_upload.dry_run");
    expect(auditJson).toContain("mappedColumnKeys");
    expect(updateJson).not.toContain("123.45");
    expect(updateJson).not.toContain("456.78");
    expect(updateJson).not.toContain("KJTEST001");
    expect(updateJson).not.toContain("OEMTEST001");
    expect(auditJson).not.toContain("signedUrl");
    expect(auditJson).not.toContain("AccessKey");
  });

  it("rejects non-uploaded records", async () => {
    const fakeDb = {
      quoteSourceUpload: {
        findUnique: async () => ({
          id: "upload_1",
          sourceFileName: "2026冷凝器成本报价表.xlsx",
          storageKey: "quote-source-uploads/2026/upload.xlsx",
          uploadStatus: "pending"
        })
      }
    } as any;

    await expect(runQuoteSourceUploadDryRun(actor("super_admin", "admin"), "upload_1", {
      db: fakeDb,
      readObjectBuffer: async () => workbookBuffer()
    })).rejects.toThrow("uploaded");
  });

  it("route and UI are feature gated and do not add import or staging side effects", () => {
    const route = readRepoFile("app/api/finance/quote-source-upload/[uploadId]/dry-run/route.ts");
    const page = readRepoFile("app/finance/quote-source-upload/page.tsx");
    const component = readRepoFile("components/finance-quote-source-upload.tsx");
    const server = readRepoFile("lib/honoa/server/quote-source-upload-dry-run.ts");
    const combined = [route, page, component, server].join("\n");

    expect(route).toContain("isFinanceQuoteSourceDryRunEnabled");
    expect(route).toContain("runQuoteSourceUploadDryRun");
    expect(page).toContain("dry-run 暂未开放");
    expect(component).toContain("dry-run 暂未开放");
    expect(component).toContain("/api/finance/quote-source-upload/${uploadId}/dry-run");
    expect(combined).not.toContain("NEXT_PUBLIC");
    expect(combined).not.toContain("quoteSourceStagingBatch.create");
    expect(combined).not.toContain("quoteSourceStagingRow.create");
    expect(combined).not.toContain("QuoteDraftLine");
  });

  it("migration is additive dry-run metadata only", () => {
    const sql = dryRunMigrationSql();

    expect(sql).toContain('ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunStatus"');
    expect(sql).toContain('ALTER TABLE "QuoteSourceUpload" ADD COLUMN "dryRunSummary"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_dryRunStatus_idx"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_dryRunAt_idx"');
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE[\s\S]*\bDROP\b/i);
    expect(sql).not.toMatch(/"(Customer|User|QuoteSourceStagingBatch|QuoteSourceStagingRow)"/);
    expect(sql).not.toMatch(/amount|unitPrice|costPrice|quotePrice|financeApprovedPrice|minimumPrice|grossMargin|profit|officialQuote/i);
  });
});
