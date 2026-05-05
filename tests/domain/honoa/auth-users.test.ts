import { describe, expect, it } from "vitest";
import { bootstrapDemoUsers, loginUser } from "@/lib/honoa/auth/actions";
import { assignUserPermissions, getUserPermissionKeys } from "@/lib/honoa/permissions/actions";
import { createUser, disableUser } from "@/lib/honoa/users/actions";
import { createKingaStore } from "@/lib/honoa/shared/mock-store";
import { createMemoryStorage } from "@/lib/honoa/shared/storage";

function freshStore() {
  const store = createKingaStore(createMemoryStorage());
  bootstrapDemoUsers(store);
  return store;
}

describe("KingaOS auth and users domain actions", () => {
  it("super_admin 可以登录", () => {
    const store = freshStore();
    const user = loginUser(store, "superadmin@kingaos.local", "roserose");
    expect(user.role).toBe("super_admin");
    expect(store.getCurrentUserId()).toBe(user.id);
  });

  it("super_admin 可以创建 admin", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const admin = createUser(store, superAdmin, {
      name: "测试管理员",
      email: "test.admin@kingaos.local",
      password: "Kingaos@123456",
      department: "admin",
      role: "admin",
      isActive: true,
      permissions: ["admin.dashboard.view"]
    });
    expect(admin.role).toBe("admin");
    expect(store.getUsers().some((user) => user.email === "test.admin@kingaos.local")).toBe(true);
  });

  it("super_admin 可以设置 admin 权限", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const admin = store.getUsers().find((user) => user.email === "admin@kingaos.local")!;
    assignUserPermissions(store, superAdmin, admin.id, ["admin.dashboard.view", "users.view"]);
    expect(getUserPermissionKeys(store, admin)).toEqual(["admin.dashboard.view", "users.view"]);
  });

  it("停用用户不能登录", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const staff = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    disableUser(store, superAdmin, staff.id);
    expect(() => loginUser(store, "export.a@kingaos.local", "Kingaos@123456")).toThrow("账号已停用");
  });
});
