import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_SYSTEM_FIELD_KEYS,
  CUSTOMER_TYPES
} from "../shared/constants";
import type { AuthUser } from "./auth";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser, requireServerPermission } from "./auth";
import { prisma } from "./db";

export function canViewCustomerServer(actor: AuthUser, customer: { ownerUserId: string; department: string }) {
  if (customer.department !== "export") return false;
  if (hasServerPermission(actor, "export.customers.view_all")) return true;
  return hasServerPermission(actor, "export.customers.view_own") && customer.ownerUserId === actor.id;
}

export function canEditCustomerServer(actor: AuthUser, customer: { ownerUserId: string; department: string }) {
  if (customer.department !== "export") return false;
  if (hasServerPermission(actor, "export.customers.edit_all")) return true;
  return hasServerPermission(actor, "export.customers.edit_own") && customer.ownerUserId === actor.id;
}

export function canAssignOwnerServer(actor: AuthUser) {
  return hasServerPermission(actor, "export.customers.view_all") || hasServerPermission(actor, "export.customers.edit_all");
}

export async function listExportCustomersForActor(actor: AuthUser, query = "") {
  if (!hasAnyServerPermission(actor, ["export.customers.view_own", "export.customers.view_all"])) {
    throw new Error("当前账号不能查看出口部客户档案。");
  }
  const where = hasServerPermission(actor, "export.customers.view_all")
    ? { department: "export" }
    : { department: "export", ownerUserId: actor.id };
  const customers = await prisma.customer.findMany({ where, orderBy: { updatedAt: "desc" } });
  const q = query.trim().toLowerCase();
  if (!q) return customers;
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
      .includes(q)
  );
}

export async function getExportCustomerForActor(actor: AuthUser, customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canViewCustomerServer(actor, customer)) throw new Error("当前账号不能查看该客户。");
  return customer;
}

export async function getExportOwners() {
  return prisma.user.findMany({ where: { department: "export", isActive: true }, orderBy: { name: "asc" } });
}

function customerPayloadFromForm(formData: FormData) {
  const payload: Record<string, string | boolean> = {};
  const customFields: Record<string, string | boolean> = {};
  for (const [key, value] of formData.entries()) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (CUSTOMER_SYSTEM_FIELD_KEYS.has(key)) payload[key] = normalized;
    else if (key.startsWith("custom_")) customFields[key] = normalized;
  }
  return { payload, customFields };
}

export async function createExportCustomerAction(formData: FormData) {
  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.create");
  const { payload, customFields } = customerPayloadFromForm(formData);
  const ownerUserId = canAssignOwnerServer(actor) ? String(payload.ownerUserId || actor.id) : actor.id;
  const owner = await prisma.user.findFirst({ where: { id: ownerUserId, department: "export", isActive: true } });
  if (!owner) throw new Error("负责业务员无效或已停用。");
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("请填写客户名称。");
  const customer = await createCustomerWithRetry({
    name,
    customerType: String(payload.customerType || CUSTOMER_TYPES[0]),
    country: String(payload.country || ""),
    city: String(payload.city || ""),
    source: String(payload.source || ""),
    status: String(payload.status || CUSTOMER_STATUSES[0]),
    ownerUserId,
    ownerName: owner.name,
    department: "export",
    contactName: String(payload.contactName || ""),
    contactTitle: String(payload.contactTitle || ""),
    phone: String(payload.phone || ""),
    email: String(payload.email || ""),
    wechatOrWhatsapp: String(payload.wechatOrWhatsapp || ""),
    companyName: String(payload.companyName || ""),
    companyWebsite: String(payload.companyWebsite || ""),
    companyAddress: String(payload.companyAddress || ""),
    mainProducts: String(payload.mainProducts || ""),
    purchaseNeed: String(payload.purchaseNeed || ""),
    sourceNote: String(payload.sourceNote || ""),
    expectedPurchaseNeed: String(payload.expectedPurchaseNeed || ""),
    customerNotes: String(payload.customerNotes || ""),
    internalNotes: String(payload.internalNotes || ""),
    specialReminder: String(payload.specialReminder || ""),
    customFields,
    createdByUserId: actor.id
  });
  await prisma.auditLog.create({
    data: { actorUserId: actor.id, action: "customer.create", entityType: "Customer", entityId: customer.id, metadata: { customerCode: customer.customerCode } }
  });
  revalidatePath("/export/customers");
  redirect(`/export/customers/${customer.id}`);
}

async function createCustomerWithRetry(data: Omit<Prisma.CustomerCreateInput, "customerCode">) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.customer.create({
        data: {
          ...data,
          customerCode: await nextCustomerCode(attempt)
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) continue;
      throw error;
    }
  }
  throw new Error("客户编号生成冲突，请重试。");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function updateExportCustomerAction(customerId: string, formData: FormData) {
  const actor = await requireCurrentUser();
  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing || !canEditCustomerServer(actor, existing)) throw new Error("当前账号不能编辑该客户。");
  const { payload, customFields } = customerPayloadFromForm(formData);
  const ownerUserId = canAssignOwnerServer(actor) ? String(payload.ownerUserId || existing.ownerUserId) : existing.ownerUserId;
  const owner = await prisma.user.findFirst({ where: { id: ownerUserId, department: "export", isActive: true } });
  if (!owner) throw new Error("负责业务员无效或已停用。");
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("请填写客户名称。");
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name,
      customerType: String(payload.customerType || CUSTOMER_TYPES[0]),
      country: String(payload.country || ""),
      city: String(payload.city || ""),
      source: String(payload.source || ""),
      status: String(payload.status || CUSTOMER_STATUSES[0]),
      ownerUserId,
      ownerName: owner.name,
      contactName: String(payload.contactName || ""),
      contactTitle: String(payload.contactTitle || ""),
      phone: String(payload.phone || ""),
      email: String(payload.email || ""),
      wechatOrWhatsapp: String(payload.wechatOrWhatsapp || ""),
      companyName: String(payload.companyName || ""),
      companyWebsite: String(payload.companyWebsite || ""),
      companyAddress: String(payload.companyAddress || ""),
      mainProducts: String(payload.mainProducts || ""),
      purchaseNeed: String(payload.purchaseNeed || ""),
      sourceNote: String(payload.sourceNote || ""),
      expectedPurchaseNeed: String(payload.expectedPurchaseNeed || ""),
      customerNotes: String(payload.customerNotes || ""),
      internalNotes: String(payload.internalNotes || ""),
      specialReminder: String(payload.specialReminder || ""),
      customFields
    }
  });
  await prisma.auditLog.create({
    data: { actorUserId: actor.id, action: "customer.update", entityType: "Customer", entityId: customerId, metadata: {} }
  });
  revalidatePath("/export/customers");
  revalidatePath(`/export/customers/${customerId}`);
  redirect(`/export/customers/${customerId}`);
}

async function nextCustomerCode(offset = 0) {
  const now = new Date();
  const prefix = `KJ-EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-`;
  const latest = await prisma.customer.findFirst({
    where: { customerCode: { startsWith: prefix } },
    orderBy: { customerCode: "desc" }
  });
  const latestNumber = latest ? Number(latest.customerCode.slice(prefix.length)) : 0;
  return `${prefix}${String(latestNumber + 1 + offset).padStart(4, "0")}`;
}
