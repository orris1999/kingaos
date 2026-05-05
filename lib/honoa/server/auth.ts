import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User as PrismaUser } from "@prisma/client";
import { ALL_PERMISSION_KEYS } from "../shared/constants";
import type { PermissionKey, User } from "../shared/domain-types";
import { verifyPassword } from "../shared/password";
import { prisma } from "./db";

export type AuthUser = User & { permissionKeys: PermissionKey[] };

const SESSION_COOKIE = "kingaos_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function getSessionSecret() {
  return process.env.SESSION_SECRET || "kingaos-local-dev-secret-change-before-production";
}

function tokenHash(token: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(token).digest("base64url");
}

function shouldUseSecureSessionCookie() {
  const value = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return process.env.NODE_ENV === "production";
}

function mapUser(user: PrismaUser, permissionKeys: PermissionKey[]): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    department: user.department as User["department"],
    role: user.role as User["role"],
    isActive: user.isActive,
    createdByUserId: user.createdByUserId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    permissionKeys
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.userSession.findUnique({
    where: { sessionTokenHash: tokenHash(token) },
    include: { user: { include: { permissions: true } } }
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now() || !session.user.isActive) {
    if (session) await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } }).catch(() => undefined);
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }
  const permissionKeys =
    session.user.role === "super_admin"
      ? [...ALL_PERMISSION_KEYS]
      : session.user.permissions.map((item) => item.permissionKey as PermissionKey);
  return mapUser(session.user, permissionKeys);
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function hasServerPermission(user: AuthUser | null, permissionKey: PermissionKey) {
  return Boolean(user?.isActive && user.permissionKeys.includes(permissionKey));
}

export function hasAnyServerPermission(user: AuthUser | null, permissionKeys: PermissionKey[]) {
  return permissionKeys.some((key) => hasServerPermission(user, key));
}

export function requireServerPermission(user: AuthUser, permissionKey: PermissionKey) {
  if (!hasServerPermission(user, permissionKey)) throw new Error("当前账号没有访问该功能的权限。");
}

export function homePathForUser(user: AuthUser): string {
  if (hasServerPermission(user, "admin.dashboard.view")) return "/admin";
  if (user.department === "export" && hasServerPermission(user, "export.dashboard.view")) return "/export";
  if (user.department === "domestic") return "/domestic";
  if (user.department === "technical") return "/technical";
  if (user.department === "finance") return "/finance";
  return "/login";
}

export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { permissions: true }
  });
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    throw new Error("邮箱或密码错误，或账号已停用。");
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.userSession.create({
    data: {
      sessionTokenHash: tokenHash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
  const permissionKeys =
    user.role === "super_admin" ? [...ALL_PERMISSION_KEYS] : user.permissions.map((item) => item.permissionKey as PermissionKey);
  return mapUser(user, permissionKeys);
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.userSession.updateMany({ where: { sessionTokenHash: tokenHash(token) }, data: { revokedAt: new Date() } });
  cookieStore.delete(SESSION_COOKIE);
}
