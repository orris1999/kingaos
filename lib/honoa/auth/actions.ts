import {
  ADMIN_DEFAULT_PERMISSIONS,
  EXPORT_MANAGER_DEFAULT_PERMISSIONS,
  EXPORT_STAFF_DEFAULT_PERMISSIONS,
  defaultCustomerFields
} from "../shared/constants";
import type { User } from "../shared/domain-types";
import type { KingaStore } from "../shared/mock-store";
import { newId, nowIso } from "../shared/mock-store";
import { hashPassword, verifyPassword } from "../shared/password";
import { hasPermission, setInitialUserPermissions } from "../permissions/actions";

const DEMO_USERS = [
  {
    name: "超级管理员",
    email: "superadmin@kingaos.local",
    password: "roserose",
    department: "admin",
    role: "super_admin",
    permissions: []
  },
  {
    name: "管理员",
    email: "admin@kingaos.local",
    password: "Kingaos@123456",
    department: "admin",
    role: "admin",
    permissions: ADMIN_DEFAULT_PERMISSIONS
  },
  {
    name: "出口部经理",
    email: "export.manager@kingaos.local",
    password: "Kingaos@123456",
    department: "export",
    role: "manager",
    permissions: EXPORT_MANAGER_DEFAULT_PERMISSIONS
  },
  {
    name: "出口部业务员A",
    email: "export.a@kingaos.local",
    password: "Kingaos@123456",
    department: "export",
    role: "staff",
    permissions: EXPORT_STAFF_DEFAULT_PERMISSIONS
  },
  {
    name: "出口部业务员B",
    email: "export.b@kingaos.local",
    password: "Kingaos@123456",
    department: "export",
    role: "staff",
    permissions: EXPORT_STAFF_DEFAULT_PERMISSIONS
  }
] as const;

export function bootstrapDemoUsers(store: KingaStore): void {
  const now = nowIso();
  const users = store.getUsers();
  const nextUsers = [...users];

  for (const demoUser of DEMO_USERS) {
    let user = nextUsers.find((item) => item.email.toLowerCase() === demoUser.email.toLowerCase());
    if (!user) {
      user = {
        id: newId("usr"),
        name: demoUser.name,
        email: demoUser.email,
        passwordHash: hashPassword(demoUser.password),
        department: demoUser.department,
        role: demoUser.role,
        isActive: true,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null
      };
      nextUsers.push(user);
    }
    setInitialUserPermissions(store, user.id, [...demoUser.permissions]);
  }

  store.saveUsers(nextUsers);

  const fields = store.getCustomerFieldConfigs();
  if (fields.length === 0) {
    store.saveCustomerFieldConfigs(defaultCustomerFields(now));
  }
}

export function loginUser(store: KingaStore, email: string, password: string): User {
  bootstrapDemoUsers(store);
  const normalizedEmail = email.trim().toLowerCase();
  const users = store.getUsers();
  const user = users.find((item) => item.email.toLowerCase() === normalizedEmail);
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    throw new Error("邮箱或密码错误，或账号已停用。");
  }
  const nextUsers = users.map((item) =>
    item.id === user.id ? { ...item, lastLoginAt: nowIso(), updatedAt: nowIso() } : item
  );
  store.saveUsers(nextUsers);
  store.setCurrentUserId(user.id);
  return nextUsers.find((item) => item.id === user.id)!;
}

export function logoutUser(store: KingaStore): void {
  store.clearCurrentUserId();
}

export function getCurrentUser(store: KingaStore): User | null {
  bootstrapDemoUsers(store);
  const currentUserId = store.getCurrentUserId();
  if (!currentUserId) return null;
  const user = store.getUsers().find((item) => item.id === currentUserId && item.isActive);
  if (!user) {
    store.clearCurrentUserId();
    return null;
  }
  return user;
}

export function homePathForUser(store: KingaStore, user: User | null): string {
  if (!user) return "/login";
  if (hasPermission(store, user, "admin.dashboard.view")) return "/admin";
  if (user.department === "export" && hasPermission(store, user, "export.dashboard.view")) return "/export";
  if (user.department === "domestic") return "/domestic";
  if (user.department === "technical") return "/technical";
  if (user.department === "finance") return "/finance";
  return "/login";
}
