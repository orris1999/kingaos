import type { PermissionKey, User, UserInput } from "../shared/domain-types";
import type { KingaStore } from "../shared/mock-store";
import { newId, nowIso } from "../shared/mock-store";
import { hashPassword } from "../shared/password";
import { assignUserPermissions, getUserPermissionKeys, hasPermission, setInitialUserPermissions } from "../permissions/actions";

function assertCanEditUser(store: KingaStore, actor: User, target: User) {
  if (!hasPermission(store, actor, "users.edit")) throw new Error("当前账号没有用户编辑权限。");
  if (actor.role !== "super_admin" && target.role === "super_admin") throw new Error("普通 admin 不能修改 super_admin。");
  if (actor.role !== "super_admin" && actor.id === target.id) throw new Error("admin 不能给自己提权或修改自己的核心权限。");
}

function ensureAtLeastOneActiveSuperAdmin(users: User[]) {
  if (!users.some((user) => user.role === "super_admin" && user.isActive)) {
    throw new Error("系统至少需要保留一个启用状态的 super_admin。");
  }
}

function validateUserInput(store: KingaStore, input: UserInput, existingUserId?: string) {
  if (!input.name.trim()) throw new Error("请填写姓名。");
  if (!input.email.includes("@")) throw new Error("请填写有效邮箱。");
  const duplicate = store
    .getUsers()
    .find((user) => user.email.toLowerCase() === input.email.trim().toLowerCase() && user.id !== existingUserId);
  if (duplicate) throw new Error("邮箱已存在。");
}

export function listUsers(store: KingaStore, actor: User): User[] {
  if (!hasPermission(store, actor, "users.view")) throw new Error("当前账号没有用户查看权限。");
  return store.getUsers().slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createUser(store: KingaStore, actor: User, input: UserInput): User {
  if (!hasPermission(store, actor, "users.create")) throw new Error("当前账号没有用户创建权限。");
  if (input.role === "super_admin" && actor.role !== "super_admin") throw new Error("非 super_admin 不能创建 super_admin。");
  if (!input.password || input.password.length < 8) throw new Error("新用户初始密码至少 8 位。");
  validateUserInput(store, input);

  const now = nowIso();
  const user: User = {
    id: newId("usr"),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: hashPassword(input.password),
    department: input.department,
    role: input.role,
    isActive: input.isActive,
    createdByUserId: actor.id,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null
  };
  store.saveUsers([...store.getUsers(), user]);
  if (input.role !== "super_admin") {
    if (hasPermission(store, actor, "permissions.manage")) {
      assignUserPermissions(store, actor, user.id, input.permissions);
    } else {
      setInitialUserPermissions(store, user.id, []);
    }
  }
  return user;
}

export function updateUser(store: KingaStore, actor: User, userId: string, input: UserInput): User {
  const users = store.getUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) throw new Error("用户不存在。");
  assertCanEditUser(store, actor, target);
  if (input.role === "super_admin" && actor.role !== "super_admin") throw new Error("非 super_admin 不能设置 super_admin。");
  validateUserInput(store, input, userId);

  const nextUsers = users.map((user) =>
    user.id === userId
      ? {
          ...user,
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          department: input.department,
          role: input.role,
          isActive: input.isActive,
          passwordHash: input.password ? hashPassword(input.password) : user.passwordHash,
          updatedAt: nowIso()
        }
      : user
  );
  ensureAtLeastOneActiveSuperAdmin(nextUsers);
  store.saveUsers(nextUsers);
  if (hasPermission(store, actor, "permissions.manage")) assignUserPermissions(store, actor, userId, input.permissions);
  return nextUsers.find((user) => user.id === userId)!;
}

export function disableUser(store: KingaStore, actor: User, userId: string): User {
  if (!hasPermission(store, actor, "users.disable")) throw new Error("当前账号没有停用用户权限。");
  const target = store.getUsers().find((user) => user.id === userId);
  if (!target) throw new Error("用户不存在。");
  return updateUser(store, actor, userId, {
    ...target,
    isActive: false,
    permissions: getUserPermissionKeys(store, target)
  });
}

export function enableUser(store: KingaStore, actor: User, userId: string): User {
  if (!hasPermission(store, actor, "users.disable")) throw new Error("当前账号没有启用用户权限。");
  const target = store.getUsers().find((user) => user.id === userId);
  if (!target) throw new Error("用户不存在。");
  return updateUser(store, actor, userId, {
    ...target,
    isActive: true,
    permissions: getUserPermissionKeys(store, target)
  });
}

export function resetUserPassword(store: KingaStore, actor: User, userId: string, password: string): User {
  const target = store.getUsers().find((user) => user.id === userId);
  if (!target) throw new Error("用户不存在。");
  if (password.length < 8) throw new Error("密码至少 8 位。");
  return updateUser(store, actor, userId, {
    ...target,
    password,
    permissions: getUserPermissionKeys(store, target)
  });
}

export type { PermissionKey };
