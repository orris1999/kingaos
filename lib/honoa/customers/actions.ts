import {
  CUSTOMER_STATUSES,
  CUSTOMER_SYSTEM_FIELD_KEYS,
  CUSTOMER_TYPES
} from "../shared/constants";
import type { ExportCustomer, ExportCustomerInput, User } from "../shared/domain-types";
import type { KingaStore } from "../shared/mock-store";
import { newId, nowIso } from "../shared/mock-store";
import { hasAnyPermission, hasPermission } from "../permissions/actions";

export function canViewCustomer(store: KingaStore, actor: User, customer: ExportCustomer): boolean {
  if (customer.department !== "export") return false;
  if (hasPermission(store, actor, "export.customers.view_all")) return true;
  return hasPermission(store, actor, "export.customers.view_own") && customer.ownerUserId === actor.id;
}

export function canEditCustomer(store: KingaStore, actor: User, customer: ExportCustomer): boolean {
  if (customer.department !== "export") return false;
  if (hasPermission(store, actor, "export.customers.edit_all")) return true;
  return hasPermission(store, actor, "export.customers.edit_own") && customer.ownerUserId === actor.id;
}

export function canAssignCustomerOwner(store: KingaStore, actor: User): boolean {
  return hasPermission(store, actor, "export.customers.view_all") || hasPermission(store, actor, "export.customers.edit_all");
}

export function getExportOwners(store: KingaStore): User[] {
  return store
    .getUsers()
    .filter((user) => user.department === "export" && user.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function listExportCustomers(store: KingaStore, actor: User): ExportCustomer[] {
  if (!hasAnyPermission(store, actor, ["export.customers.view_own", "export.customers.view_all"])) {
    throw new Error("当前账号没有查看出口部客户档案的权限。");
  }
  return store
    .getCustomers()
    .filter((customer) => canViewCustomer(store, actor, customer))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function searchExportCustomers(store: KingaStore, actor: User, query: string): ExportCustomer[] {
  const normalized = query.trim().toLowerCase();
  const customers = listExportCustomers(store, actor);
  if (!normalized) return customers;
  return customers.filter((customer) =>
    [
      customer.customerCode,
      customer.name,
      customer.customerType,
      customer.country,
      customer.city,
      customer.source,
      customer.status,
      customer.ownerName
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

export function getExportCustomerById(store: KingaStore, actor: User, customerId: string): ExportCustomer {
  const customer = store.getCustomers().find((item) => item.id === customerId);
  if (!customer || !canViewCustomer(store, actor, customer)) throw new Error("当前账号不能查看该客户。");
  return customer;
}

export function createExportCustomer(store: KingaStore, actor: User, input: ExportCustomerInput): ExportCustomer {
  if (!hasPermission(store, actor, "export.customers.create")) throw new Error("当前账号没有新建出口部客户的权限。");
  const ownerUserId = canAssignCustomerOwner(store, actor) ? input.ownerUserId || actor.id : actor.id;
  if (!canAssignCustomerOwner(store, actor) && input.ownerUserId && input.ownerUserId !== actor.id) {
    throw new Error("业务员只能把客户分配给自己。");
  }
  const owner = store.getUsers().find((user) => user.id === ownerUserId && user.department === "export" && user.isActive);
  if (!owner) throw new Error("负责业务员无效或已停用。");
  if (!input.name.trim()) throw new Error("请填写客户名称。");

  const now = nowIso();
  const customer: ExportCustomer = {
    id: newId("cus"),
    customerCode: nextCustomerCode(store),
    name: input.name.trim(),
    customerType: input.customerType || CUSTOMER_TYPES[0],
    country: input.country || "",
    city: input.city || "",
    source: input.source || "",
    status: input.status || CUSTOMER_STATUSES[0],
    ownerUserId,
    ownerName: owner.name,
    department: "export",
    contactName: input.contactName || "",
    contactTitle: input.contactTitle || "",
    phone: input.phone || "",
    email: input.email || "",
    wechatOrWhatsapp: input.wechatOrWhatsapp || "",
    companyName: input.companyName || "",
    companyWebsite: input.companyWebsite || "",
    companyAddress: input.companyAddress || "",
    mainProducts: input.mainProducts || "",
    purchaseNeed: input.purchaseNeed || "",
    sourceNote: input.sourceNote || "",
    expectedPurchaseNeed: input.expectedPurchaseNeed || "",
    customerNotes: input.customerNotes || "",
    internalNotes: input.internalNotes || "",
    specialReminder: input.specialReminder || "",
    customFields: input.customFields || {},
    createdByUserId: actor.id,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  };
  store.saveCustomers([...store.getCustomers(), customer]);
  return customer;
}

export function updateExportCustomer(store: KingaStore, actor: User, customerId: string, input: ExportCustomerInput): ExportCustomer {
  const customers = store.getCustomers();
  const existing = customers.find((customer) => customer.id === customerId);
  if (!existing || !canEditCustomer(store, actor, existing)) throw new Error("当前账号不能编辑该客户。");
  const ownerUserId = canAssignCustomerOwner(store, actor) ? input.ownerUserId || existing.ownerUserId : existing.ownerUserId;
  const owner = store.getUsers().find((user) => user.id === ownerUserId && user.department === "export" && user.isActive);
  if (!owner) throw new Error("负责业务员无效或已停用。");
  if (!input.name.trim()) throw new Error("请填写客户名称。");

  const next: ExportCustomer = {
    ...existing,
    ...pickSystemCustomerFields(input),
    name: input.name.trim(),
    ownerUserId,
    ownerName: owner.name,
    customFields: input.customFields || existing.customFields,
    customerCode: existing.customerCode,
    createdByUserId: existing.createdByUserId,
    createdAt: existing.createdAt,
    updatedAt: nowIso()
  };
  store.saveCustomers(customers.map((customer) => (customer.id === customerId ? next : customer)));
  return next;
}

function pickSystemCustomerFields(input: ExportCustomerInput): Partial<ExportCustomer> {
  const picked: Partial<ExportCustomer> = {};
  for (const [key, value] of Object.entries(input)) {
    if (CUSTOMER_SYSTEM_FIELD_KEYS.has(key) && key !== "customerCode" && key !== "createdAt" && key !== "updatedAt") {
      (picked as Record<string, unknown>)[key] = value;
    }
  }
  return picked;
}

export function nextCustomerCode(store: KingaStore): string {
  const date = new Date();
  const prefix = `KJ-EXP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-`;
  let max = 0;
  for (const customer of store.getCustomers()) {
    if (!customer.customerCode.startsWith(prefix)) continue;
    const numeric = Number(customer.customerCode.slice(prefix.length));
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  let next = max + 1;
  let code = `${prefix}${String(next).padStart(4, "0")}`;
  while (store.getCustomers().some((customer) => customer.customerCode === code)) {
    next += 1;
    code = `${prefix}${String(next).padStart(4, "0")}`;
  }
  return code;
}
