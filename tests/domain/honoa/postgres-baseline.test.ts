import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/honoa/shared/password";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260505000000_init/migration.sql"), "utf8");
const sourceConfigMigration = readFileSync(join(process.cwd(), "prisma/migrations/20260506090000_make_customer_source_configurable/migration.sql"), "utf8");
const customerServerActions = readFileSync(join(process.cwd(), "lib/honoa/server/customers.ts"), "utf8");
const authServerActions = readFileSync(join(process.cwd(), "lib/honoa/server/auth.ts"), "utf8");
const fieldConfigServerActions = readFileSync(join(process.cwd(), "lib/honoa/server/field-config.ts"), "utf8");

describe("KingaOS PostgreSQL production-lite baseline", () => {
  it("Prisma schema 使用 PostgreSQL 且不使用 SQLite", () => {
    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).toMatch(/directUrl\s*=\s*env\("DIRECT_URL"\)/);
    expect(schema).not.toMatch(/provider\s*=\s*"sqlite"/);
  });

  it("Prisma schema 包含多人共享核心模型", () => {
    for (const model of ["User", "Permission", "UserPermission", "UserSession", "Customer", "CustomerIdentity", "CustomerDuplicateReviewRequest", "CustomerFieldConfig", "AuditLog"]) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("Prisma schema 保留关键 unique 和 index 约束", () => {
    expect(schema).toContain("email           String    @unique");
    expect(schema).toMatch(/key\s+String\s+@unique/);
    expect(schema).toContain("@@unique([userId, permissionKey])");
    expect(schema).toMatch(/customerCode\s+String\s+@unique/);
    expect(schema).toContain("@@unique([scope, normalizedName])");
    expect(schema).toContain("@@index([normalizedName])");
    expect(schema).toContain("@@index([ownerUserId])");
    expect(schema).toContain("@@index([department])");
    expect(schema).toContain("@@index([status])");
    expect(schema).toContain("@@index([updatedAt])");
    expect(schema).toContain("@@unique([moduleKey, fieldKey])");
  });

  it("migration 使用 JSONB 并创建客户编号唯一索引", () => {
    expect(migration).toContain('"customFields" JSONB NOT NULL DEFAULT');
    expect(migration).toContain('CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode")');
  });

  it("客户编号由服务端生成，并对数据库唯一冲突 retry", () => {
    expect(customerServerActions).toContain("async function createCustomerWithRetry");
    expect(customerServerActions).toContain("customerCode: await nextCustomerCode(attempt)");
    expect(customerServerActions).toContain('error.code === "P2002"');
    expect(customerServerActions).toContain("客户编号生成冲突，请重试");
  });

  it("密码使用 PBKDF2 hash，不保存明文", () => {
    const passwordHash = hashPassword("roserose");
    expect(passwordHash).toMatch(/^pbkdf2_sha256\$/);
    expect(passwordHash).not.toContain("roserose");
    expect(verifyPassword("roserose", passwordHash)).toBe(true);
    expect(verifyPassword("wrong-password", passwordHash)).toBe(false);
  });

  it("服务端 session 使用 httpOnly cookie 并支持 SESSION_COOKIE_SECURE", () => {
    expect(authServerActions).toContain("httpOnly: true");
    expect(authServerActions).toContain('sameSite: "lax"');
    expect(authServerActions).toContain("SESSION_COOKIE_SECURE");
    expect(authServerActions).toContain("shouldUseSecureSessionCookie()");
  });

  it("字段类型修改由服务端权限控制并写入 AuditLog", () => {
    expect(fieldConfigServerActions).toContain('requireServerPermission(actor, "export.customers.fields.manage")');
    expect(fieldConfigServerActions).toContain('"update_customer_field_type"');
    expect(fieldConfigServerActions).toContain("oldFieldType");
    expect(fieldConfigServerActions).toContain("newFieldType");
  });

  it("客户来源字段配置迁移只更新字段配置，不触碰客户数据", () => {
    expect(sourceConfigMigration).toContain('UPDATE "CustomerFieldConfig"');
    expect(sourceConfigMigration).toContain('"fieldKey" = \'source\'');
    expect(sourceConfigMigration).toContain('"isSystemField" = false');
    expect(sourceConfigMigration).not.toMatch(/UPDATE\s+"Customer"/);
    expect(sourceConfigMigration).not.toMatch(/DELETE|TRUNCATE|DROP/i);
  });
});
