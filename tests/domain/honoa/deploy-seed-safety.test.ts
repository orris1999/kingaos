import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seed = readFileSync(join(process.cwd(), "prisma/seed.mjs"), "utf8");
const bootstrap = readFileSync(join(process.cwd(), "prisma/bootstrap-default-users.mjs"), "utf8");
const backfill = readFileSync(join(process.cwd(), "scripts/backfill-customer-identities.mjs"), "utf8");

describe("KingaOS deploy seed safety", () => {
  it("production db:seed 不创建用户", () => {
    expect(seed).not.toMatch(/prisma\.user\.(create|upsert|createMany)/);
  });

  it("production db:seed 不更新用户", () => {
    expect(seed).not.toMatch(/prisma\.user\.(update|updateMany)/);
  });

  it("production db:seed 不删除用户", () => {
    expect(seed).not.toMatch(/prisma\.user\.(delete|deleteMany)/);
  });

  it("production db:seed 不创建客户", () => {
    expect(seed).not.toMatch(/prisma\.customer\.(create|upsert|createMany)/);
  });

  it("production db:seed 不更新客户", () => {
    expect(seed).not.toMatch(/prisma\.customer\.(update|updateMany)/);
  });

  it("production db:seed 不删除客户", () => {
    expect(seed).not.toMatch(/prisma\.customer\.(delete|deleteMany)/);
  });

  it("production db:seed 只允许补系统权限和缺失字段配置", () => {
    expect(seed).not.toMatch(/prisma\.user\.(create|upsert|update|delete|deleteMany|createMany|updateMany)/);
    expect(seed).not.toMatch(/prisma\.customer\.(create|upsert|update|delete|deleteMany|createMany|updateMany)/);
    expect(seed).toMatch(/prisma\.permission\.upsert/);
    expect(seed).toMatch(/prisma\.customerFieldConfig\.create/);
    expect(seed).not.toContain("passwordHash");
    expect(seed).toContain("Users and customers were not modified");
  });

  it("默认用户 bootstrap 必须显式确认才能运行", () => {
    expect(bootstrap).toContain("ALLOW_DEFAULT_USER_BOOTSTRAP");
    expect(bootstrap).toContain('process.env.ALLOW_DEFAULT_USER_BOOTSTRAP !== "true"');
    expect(bootstrap).toContain("process.exit(1)");
  });

  it("production 默认用户 bootstrap 需要二次确认", () => {
    expect(bootstrap).toContain("BOOTSTRAP_DEFAULT_USERS_CONFIRM");
    expect(bootstrap).toContain("I_UNDERSTAND_THIS_CREATES_USERS");
  });

  it("已有非默认用户时 bootstrap 需要额外确认", () => {
    expect(bootstrap).toContain("nonDefaultUserCount");
    expect(bootstrap).toContain("BOOTSTRAP_NON_DEFAULT_USERS_CONFIRM");
    expect(bootstrap).toContain("I_UNDERSTAND_THIS_DATABASE_ALREADY_HAS_USERS");
  });

  it("customer identity backfill 默认 dry-run，不写业务数据", () => {
    expect(backfill).toContain("DRY-RUN");
    expect(backfill).toContain("BACKFILL_CONFIRM");
    expect(backfill).toContain("I_UNDERSTAND_THIS_CHANGES_BUSINESS_DATA");
    expect(backfill).toContain("No database writes were made");
    const writeIndex = backfill.indexOf("prisma.customer.update");
    const confirmExitIndex = backfill.indexOf("process.exit(0)");
    expect(confirmExitIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(confirmExitIndex);
  });

  it("customer identity backfill 不删除客户或清空业务数据", () => {
    expect(backfill).not.toMatch(/prisma\.customer\.(delete|deleteMany)/);
    expect(backfill).not.toMatch(/truncate|TRUNCATE|deleteMany|DROP/);
    expect(backfill).not.toContain("ownerUserId");
    expect(backfill).not.toMatch(/prisma\.customer\.update\(\{[\s\S]*data:\s*\{[\s\S]*\n\s*name\s*:/);
  });
});
