import type { PermissionKey, Role } from "../shared/domain-types";

export type DomesticModuleStatus = "not_open" | "open";

export const DOMESTIC_MODULE_STATUS: DomesticModuleStatus = "not_open";

type DomesticAccessUser = {
  role: Role;
  isActive: boolean;
  permissionKeys: readonly PermissionKey[];
} | null;

export function canAccessDomesticUnavailablePage(user: DomesticAccessUser): boolean {
  return Boolean(user?.isActive && user.role === "super_admin");
}

export function assertCanAccessDomesticUnavailablePage(user: DomesticAccessUser): void {
  if (!canAccessDomesticUnavailablePage(user)) {
    throw new Error("Domestic department is not open");
  }
}

export function canAccessDomesticDashboard(user: DomesticAccessUser): boolean {
  if (!user?.isActive) return false;
  if (user.role === "super_admin") return true;
  if (DOMESTIC_MODULE_STATUS === "not_open") return false;
  return user.permissionKeys.includes("domestic.dashboard.view");
}
