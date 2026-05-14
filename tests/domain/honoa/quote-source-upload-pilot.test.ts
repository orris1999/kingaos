import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertQuoteSourceUploadObjectKey,
  generateQuoteSourceUploadObjectKey,
  validateQuoteSourceUploadRequest
} from "@/lib/honoa/server/oss";
import {
  assertCanManageQuoteSourceUpload,
  assertNoQuoteSourceUploadSensitiveFields
} from "@/lib/honoa/server/quote-source-upload";

const root = process.cwd();

const ossEnv = {
  ALIYUN_OSS_REGION: "oss-cn-guangzhou",
  ALIYUN_OSS_BUCKET: "kinga",
  ALIYUN_OSS_ENDPOINT: "https://oss-cn-guangzhou.aliyuncs.com",
  ALIYUN_OSS_ACCESS_KEY_ID: "test-key-id",
  ALIYUN_OSS_ACCESS_KEY_SECRET: "test-key-secret",
  ALIYUN_OSS_QUOTE_SOURCE_UPLOAD_PREFIX: "quote-source-uploads",
  ALIYUN_OSS_SIGNED_URL_EXPIRES_SECONDS: "600",
  ALIYUN_OSS_QUOTE_SOURCE_MAX_FILE_SIZE_MB: "50"
};

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

function migrationSql() {
  const migrationRoot = join(root, "prisma/migrations");
  if (!existsSync(migrationRoot)) return "";
  const uploadMigration = readdirSync(migrationRoot)
    .filter((name) => name.includes("add_quote_source_upload_metadata"))
    .sort()
    .at(-1);
  if (!uploadMigration) return "";
  return readFileSync(join(migrationRoot, uploadMigration, "migration.sql"), "utf8");
}

describe("Finance quote source upload pilot", () => {
  it("only super_admin can manage quote source uploads", () => {
    expect(() => assertCanManageQuoteSourceUpload(actor("super_admin", "admin"))).not.toThrow();
    expect(() => assertCanManageQuoteSourceUpload(actor("admin", "admin"))).toThrow("不能上传");
    expect(() => assertCanManageQuoteSourceUpload(actor("manager", "export"))).toThrow("不能上传");
    expect(() => assertCanManageQuoteSourceUpload(actor("sales", "export"))).toThrow("不能上传");
  });

  it("allows only .xls / .xlsx within 50MB", () => {
    const xls = validateQuoteSourceUploadRequest({ fileName: "报价表.xls", fileSize: 1024, mimeType: "application/vnd.ms-excel" }, ossEnv);
    const xlsx = validateQuoteSourceUploadRequest({
      fileName: "报价表.xlsx",
      fileSize: 50 * 1024 * 1024,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }, ossEnv);

    expect(xls.fileExt).toBe(".xls");
    expect(xlsx.fileExt).toBe(".xlsx");
    expect(() => validateQuoteSourceUploadRequest({ fileName: "bad.exe", fileSize: 1024, mimeType: "application/octet-stream" }, ossEnv)).toThrow("只允许上传");
    expect(() => validateQuoteSourceUploadRequest({ fileName: "bad.js", fileSize: 1024, mimeType: "application/javascript" }, ossEnv)).toThrow("只允许上传");
    expect(() => validateQuoteSourceUploadRequest({ fileName: "bad.html", fileSize: 1024, mimeType: "text/html" }, ossEnv)).toThrow("只允许上传");
    expect(() => validateQuoteSourceUploadRequest({ fileName: "large.xlsx", fileSize: 51 * 1024 * 1024, mimeType: "" }, ossEnv)).toThrow("50MB");
  });

  it("server generates private OSS keys under quote-source-uploads", () => {
    const key = generateQuoteSourceUploadObjectKey("../财务报价.xlsx", new Date("2026-05-14T00:00:00.000Z"), ossEnv);

    expect(key).toMatch(/^quote-source-uploads\/2026\/[0-9a-f-]+-财务报价\.xlsx$/);
    expect(assertQuoteSourceUploadObjectKey(key, ossEnv)).toBe(key);
    expect(() => assertQuoteSourceUploadObjectKey("customers/cus_1/2026/file.xlsx", ossEnv)).toThrow("objectKey");
    expect(() => assertQuoteSourceUploadObjectKey("quote-source-uploads/../file.xlsx", ossEnv)).toThrow("objectKey");
  });

  it("upload URL route requires super_admin and writes AuditLog", () => {
    const source = readRepoFile("app/api/finance/quote-source-upload/upload-url/route.ts");

    expect(source).toContain("getCurrentUser");
    expect(source).toContain("status: 401");
    expect(source).toContain("assertCanManageQuoteSourceUpload");
    expect(source).toContain("generateQuoteSourceUploadPutSignedUrl");
    expect(source).toContain("quote_source_upload.upload_url.generate");
    expect(source).not.toContain("NEXT_PUBLIC");
  });

  it("metadata route saves only upload metadata and rejects sensitive price fields", () => {
    const route = readRepoFile("app/api/finance/quote-source-upload/route.ts");
    const server = readRepoFile("lib/honoa/server/quote-source-upload.ts");

    expect(route).toContain("createQuoteSourceUploadMetadata");
    expect(route).toContain("assertNoQuoteSourceUploadSensitiveFields");
    expect(server).toContain("quoteSourceUpload.create");
    expect(server).toContain('uploadStatus: "uploaded"');
    expect(server).toContain('submittedByRole: "finance"');
    expect(server).toContain('consumerDepartment: "export"');
    expect(server).toContain("quote_source_upload.create");
    expect(() => assertNoQuoteSourceUploadSensitiveFields({ sourceFileName: "safe.xlsx", amount: 100 })).toThrow("sensitive price fields");
    expect(() => assertNoQuoteSourceUploadSensitiveFields({ sourceFileName: "safe.xlsx", costPrice: 100 })).toThrow("sensitive price fields");
    expect(() => assertNoQuoteSourceUploadSensitiveFields({ sourceFileName: "safe.xlsx", financeApprovedPrice: 100 })).toThrow("sensitive price fields");
    expect(() => assertNoQuoteSourceUploadSensitiveFields({ sourceFileName: "safe.xlsx" })).not.toThrow();
  });

  it("Finance page exposes a super_admin-only Pilot upload entry and metadata-only list", () => {
    const financePage = readRepoFile("app/finance/page.tsx");
    const uploadPage = readRepoFile("app/finance/quote-source-upload/page.tsx");
    const uploadClient = readRepoFile("components/finance-quote-source-upload.tsx");

    expect(financePage).toContain('href="/finance/quote-source-upload"');
    expect(financePage).toContain("报价表上传");
    expect(financePage).toContain("Pilot");
    expect(uploadPage).toContain('user.role !== "super_admin"');
    expect(uploadPage).toContain("当前不导入价格，不生成报价草稿，不生成正式报价");
    expect(uploadPage).toContain("不展示 Excel 内容、KJ 明细、OEM 明细或任何金额");
    expect(uploadClient).toContain("/api/finance/quote-source-upload/upload-url");
    expect(uploadClient).toContain('method: "PUT"');
    expect(uploadClient).toContain("不解析 Excel、不保存 KJ 行、不保存金额、不创建 staging rows");
  });

  it("QuoteSourceUpload schema is metadata-only", () => {
    const schema = readRepoFile("prisma/schema.prisma");
    const modelStart = schema.indexOf("model QuoteSourceUpload");
    const modelEnd = schema.indexOf("model AuditLog", modelStart);
    const model = schema.slice(modelStart, modelEnd);

    expect(model).toContain("sourceFileName");
    expect(model).toContain("originalFileName");
    expect(model).toContain("storageKey");
    expect(model).toMatch(/storageProvider\s+String\s+@default\("aliyun_oss"\)/);
    expect(model).toMatch(/uploadStatus\s+String\s+@default\("uploaded"\)/);
    expect(model).toMatch(/submittedByRole\s+String\s+@default\("finance"\)/);
    expect(model).toContain('consumerDepartment String   @default("export")');
    expect(model).not.toMatch(/amount|costPrice|quotePrice|financeApprovedPrice|minimumPrice|grossMargin|margin|profit/i);
    expect(model).not.toMatch(/kjRows|oemRows|excelContent|officialQuote|sentToCustomer/i);
  });

  it("upload implementation does not create staging rows or quote drafts", () => {
    const combined = [
      readRepoFile("app/api/finance/quote-source-upload/upload-url/route.ts"),
      readRepoFile("app/api/finance/quote-source-upload/route.ts"),
      readRepoFile("lib/honoa/server/quote-source-upload.ts")
    ].join("\n");

    expect(combined).not.toContain("quoteSourceStagingBatch.create");
    expect(combined).not.toContain("quoteSourceStagingRow.create");
    expect(combined).not.toContain("QuoteDraft");
    expect(combined).not.toContain("QuoteDraftLine");
  });

  it("migration is additive and only creates QuoteSourceUpload table and indexes", () => {
    const sql = migrationSql();

    expect(sql).toContain('CREATE TABLE "QuoteSourceUpload"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_adapterId_idx"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_category_idx"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_uploadStatus_idx"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceUpload_uploadedAt_idx"');
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\s+"(Customer|User|QuoteSourceStagingBatch|QuoteSourceStagingRow)"/i);
  });
});
