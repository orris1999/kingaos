import { ALL_PERMISSION_KEYS } from "../shared/constants";
import type { PermissionKey, User, UserPermission } from "../shared/domain-types";
import type { KingaStore } from "../shared/mock-store";

export function getUserPermissionKeys(store: KingaStore, user: User | null): PermissionKey[] {
  if (!user || !user.isActive) return [];
  if (user.role === "super_admin") return [...ALL_PERMISSION_KEYS];
  return store
    .getPermissions()
    .filter((item) => item.userId === user.id)
    .map((item) => item.permissionKey);
}

export function hasPermission(store: KingaStore, user: User | null, permissionKey: PermissionKey): boolean {
  if (!user || !user.isActive) return false;
  if (user.role === "super_admin") return ALL_PERMISSION_KEYS.includes(permissionKey);
  return store.getPermissions().some((item) => item.userId === user.id && item.permissionKey === permissionKey);
}

export function hasAnyPermission(store: KingaStore, user: User | null, permissionKeys: PermissionKey[]): boolean {
  return permissionKeys.some((key) => hasPermission(store, user, key));
}

export function assignUserPermissions(store: KingaStore, actor: User, targetUserId: string, permissionKeys: PermissionKey[]): UserPermission[] {
  if (!hasPermission(store, actor, "permissions.manage")) {
    throw new Error("当前账号没有权限管理权限。");
  }
  const target = store.getUsers().find((user) => user.id === targetUserId);
  if (!target) throw new Error("用户不存在。");
  if (actor.role !== "super_admin" && (target.role === "super_admin" || actor.id === target.id)) {
    throw new Error("普通 admin 不能修改 super_admin 或给自己提权。");
  }
  const allowed = new Set(ALL_PERMISSION_KEYS);
  const unique = [...new Set(permissionKeys)].filter((key) => allowed.has(key));
  const next = store.getPermissions().filter((item) => item.userId !== targetUserId);
  if (target.role !== "super_admin") {
    for (const permissionKey of unique) next.push({ userId: targetUserId, permissionKey });
  }
  store.savePermissions(next);
  return next;
}

export function setInitialUserPermissions(store: KingaStore, targetUserId: string, permissionKeys: PermissionKey[]) {
  const allowed = new Set(ALL_PERMISSION_KEYS);
  const rest = store.getPermissions().filter((item) => item.userId !== targetUserId);
  store.savePermissions([
    ...rest,
    ...[...new Set(permissionKeys)].filter((key) => allowed.has(key)).map((permissionKey) => ({ userId: targetUserId, permissionKey }))
  ]);
}
