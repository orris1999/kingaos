import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PermissionKey } from "../shared/domain-types";
import { hashPassword } from "../shared/password";
import type { AuthUser } from "./auth";
import { hasServerPermission, requireCurrentUser, requireServerPermission } from "./auth";
import { prisma } from "./db";

export async function listUsersForActor(actor: AuthUser) {
  requireServerPermission(actor, "users.view");
  return prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { permissions: true } });
}

export async function getUserForEdit(actor: AuthUser, id: string) {
  requireServerPermission(actor, "users.edit");
  return prisma.user.findUnique({ where: { id }, include: { permissions: true } });
}

function formPermissions(formData: FormData): PermissionKey[] {
  return formData.getAll("permissions").map(String) as PermissionKey[];
}

async function ensureAtLeastOneActiveSuperAdmin(nextRole: string, nextIsActive: boolean, targetId?: string) {
  if (nextRole === "super_admin" && nextIsActive) return;
  const activeSuperAdmins = await prisma.user.count({
    where: { role: "super_admin", isActive: true, id: targetId ? { not: targetId } : undefined }
  });
  if (activeSuperAdmins === 0) throw new Error("系统至少需要保留一个启用状态的 super_admin。");
}

async function assertCanMutateTarget(actor: AuthUser, targetRole?: string, targetId?: string) {
  if (actor.role !== "super_admin" && targetRole === "super_admin") throw new Error("普通 admin 不能修改 super_admin。");
  if (actor.role !== "super_admin" && targetId && actor.id === targetId) throw new Error("admin 不能给自己提权。");
}

export async function createUserAction(formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "users.create");
  const role = String(formData.get("role") || "staff");
  if (role === "super_admin" && actor.role !== "super_admin") throw new Error("非 super_admin 不能创建 super_admin。");
  const password = String(formData.get("password") || "");
  if (password.length < 8) throw new Error("新用户初始密码至少 8 位。");
  const user = await prisma.user.create({
    data: {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim().toLowerCase(),
      passwordHash: hashPassword(password),
      department: String(formData.get("department") || "export"),
      role,
      isActive: formData.get("isActive") === "1",
      createdByUserId: actor.id
    }
  });
  if (role !== "super_admin" && hasServerPermission(actor, "permissions.manage")) {
    await setUserPermissions(user.id, formPermissions(formData));
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUserAction(userId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "users.edit");
  const target = await prisma.user.findUnique({ where: { id: userId }, include: { permissions: true } });
  if (!target) throw new Error("用户不存在。");
  await assertCanMutateTarget(actor, target.role, target.id);
  const role = String(formData.get("role") || target.role);
  if (role === "super_admin" && actor.role !== "super_admin") throw new Error("非 super_admin 不能设置 super_admin。");
  const isActive = hasServerPermission(actor, "users.disable") ? formData.get("isActive") === "1" : target.isActive;
  await ensureAtLeastOneActiveSuperAdmin(role, isActive, target.id);
  const password = String(formData.get("password") || "");
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim().toLowerCase(),
      department: String(formData.get("department") || target.department),
      role,
      isActive,
      ...(password ? { passwordHash: hashPassword(password) } : {})
    }
  });
  if (role !== "super_admin" && hasServerPermission(actor, "permissions.manage")) {
    await setUserPermissions(userId, formPermissions(formData));
  }
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}/edit`);
  redirect("/admin/users");
}

export async function setUserPermissions(userId: string, permissions: PermissionKey[]) {
  await prisma.userPermission.deleteMany({ where: { userId } });
  if (permissions.length) {
    await prisma.userPermission.createMany({
      data: [...new Set(permissions)].map((permissionKey) => ({ userId, permissionKey })),
      skipDuplicates: true
    });
  }
}
