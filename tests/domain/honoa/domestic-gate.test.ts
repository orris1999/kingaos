import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCanAccessDomesticUnavailablePage,
  canAccessDomesticDashboard,
  canAccessDomesticUnavailablePage,
  DOMESTIC_MODULE_STATUS
} from "@/lib/honoa/server/domestic-access";
import { homePathForUser, type AuthUser } from "@/lib/honoa/server/auth";

const adminPage = readRepoFile("app/admin/page.tsx");
const domesticPage = readRepoFile("app/domestic/page.tsx");
const domesticCatchAllPage = readRepoFile("app/domestic/[...slug]/page.tsx");

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "usr_test",
    name: "测试用户",
    email: "test@kingaos.local",
    passwordHash: "hash",
    department: "domestic",
    role: "staff",
    isActive: true,
    createdByUserId: null,
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
    lastLoginAt: null,
    permissionKeys: [],
    ...overrides
  };
}

describe("KingaOS domestic unavailable gate", () => {
  it("domestic module 当前保持 not_open", () => {
    expect(DOMESTIC_MODULE_STATUS).toBe("not_open");
  });

  it("super_admin 可以通过 domestic unavailable gate", () => {
    const superAdmin = user({ department: "admin", role: "super_admin" });
    expect(canAccessDomesticUnavailablePage(superAdmin)).toBe(true);
    expect(canAccessDomesticDashboard(superAdmin)).toBe(true);
    expect(() => assertCanAccessDomesticUnavailablePage(superAdmin)).not.toThrow();
  });

  it("普通用户不能通过 domestic unavailable gate", () => {
    const staff = user({ department: "export", role: "staff", permissionKeys: ["export.dashboard.view"] });
    expect(canAccessDomesticUnavailablePage(staff)).toBe(false);
    expect(canAccessDomesticDashboard(staff)).toBe(false);
    expect(() => assertCanAccessDomesticUnavailablePage(staff)).toThrow("Domestic department is not open");
  });

  it("domestic 部门普通用户不能因为部门归属进入 /domestic", () => {
    const domesticStaff = user({ department: "domestic", role: "staff" });
    expect(canAccessDomesticUnavailablePage(domesticStaff)).toBe(false);
    expect(canAccessDomesticDashboard(domesticStaff)).toBe(false);
  });

  it("模块未开放时 domestic.dashboard.view 不开放国内部页面", () => {
    const domesticPermissionUser = user({
      department: "domestic",
      role: "staff",
      permissionKeys: ["domestic.dashboard.view"]
    });
    expect(canAccessDomesticDashboard(domesticPermissionUser)).toBe(false);
    expect(homePathForUser(domesticPermissionUser)).not.toBe("/domestic");
    expect(homePathForUser(domesticPermissionUser)).toBe("/login");
  });

  it("domestic gate 不影响出口部 homePath", () => {
    const exportStaff = user({
      department: "export",
      role: "staff",
      permissionKeys: ["export.dashboard.view"]
    });
    expect(homePathForUser(exportStaff)).toBe("/export");
  });

  it("admin 首页国内部卡片仍是无链接暂未开放入口", () => {
    expect(adminPage).toContain('<DisabledCard title="国内部" description="功能暂未开放" />');
    expect(adminPage).not.toContain('href="/domestic"');
  });

  it("/domestic 和 catch-all route 共用同一个服务端 gate", () => {
    expect(domesticPage).toContain("canAccessDomesticDashboard(user)");
    expect(domesticPage).toContain("国内部功能暂未开放");
    expect(domesticPage).not.toContain("DomesticCustomerProfile");
    expect(domesticCatchAllPage).toContain('import DomesticPage from "../page"');
    expect(domesticCatchAllPage).toContain("export default DomesticPage");
  });
});
