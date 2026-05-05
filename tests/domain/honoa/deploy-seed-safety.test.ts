import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seed = readFileSync(join(process.cwd(), "prisma/seed.mjs"), "utf8");
const bootstrap = readFileSync(join(process.cwd(), "prisma/bootstrap-default-users.mjs"), "utf8");

describe("KingaOS deploy seed safety", () => {
  it("production db:seed 不创建或修改用户和客户业务数据", () => {
    expect(seed).not.toMatch(/prisma\.user\.(create|upsert|update|delete|deleteMany|createMany|updateMany)/);
    expect(seed).not.toMatch(/prisma\.customer\.(create|upsert|update|delete|deleteMany|createMany|updateMany)/);
    expect(seed).not.toContain("passwordHash");
    expect(seed).toContain("Users and customers were not modified");
  });

  it("默认用户 bootstrap 必须显式确认才能运行", () => {
    expect(bootstrap).toContain("ALLOW_DEFAULT_USER_BOOTSTRAP");
    expect(bootstrap).toContain('process.env.ALLOW_DEFAULT_USER_BOOTSTRAP !== "true"');
    expect(bootstrap).toContain("process.exit(1)");
  });
});
