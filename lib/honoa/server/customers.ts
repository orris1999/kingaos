import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CUSTOMER_ATTACHMENT_TYPES,
  CUSTOMER_STATUSES,
  CUSTOMER_SYSTEM_FIELD_KEYS,
  CUSTOMER_TYPES
} from "../shared/constants";
import { normalizeCustomerAttachment, normalizeCustomerContacts, type CustomerContactDraft } from "../shared/customer-relations";
import { customerGeoDisplay, normalizeCustomerGeo } from "../shared/geo";
import type { AuthUser } from "./auth";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser, requireServerPermission } from "./auth";
import { prisma } from "./db";
import { resolveCustomerGeoInput } from "./geo";

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
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] } }
  });
  const q = query.trim().toLowerCase();
  if (!q) return customers;
  return customers.filter((customer) =>
    [
      customer.customerCode,
      customer.name,
      customer.customerType,
      customerGeoDisplay(customer).full,
      customer.source,
      customer.status,
      customer.ownerName,
      primaryContactSummary(customer)?.name,
      primaryContactSummary(customer)?.phone,
      primaryContactSummary(customer)?.email
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export async function getExportCustomerForActor(actor: AuthUser, customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }
    }
  });
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

function parseCustomerContacts(formData: FormData): CustomerContactDraft[] {
  const count = Number(formData.get("contactCount") || 0);
  const contacts: CustomerContactDraft[] = [];
  for (let index = 0; index < count; index += 1) {
    contacts.push({
      id: String(formData.get(`contact_${index}_id`) || ""),
      name: String(formData.get(`contact_${index}_name`) || ""),
      title: String(formData.get(`contact_${index}_title`) || ""),
      phone: String(formData.get(`contact_${index}_phone`) || ""),
      email: String(formData.get(`contact_${index}_email`) || ""),
      wechatOrWhatsapp: String(formData.get(`contact_${index}_wechatOrWhatsapp`) || ""),
      isPrimary: formData.get(`contact_${index}_isPrimary`) === "1",
      notes: String(formData.get(`contact_${index}_notes`) || ""),
      sortOrder: Number(formData.get(`contact_${index}_sortOrder`) || index)
    });
  }
  return normalizeCustomerContacts(contacts);
}

type CustomerWithContactFallback = {
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  wechatOrWhatsapp: string;
  contacts?: Array<{
    id: string;
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    wechatOrWhatsapp: string | null;
    isPrimary: boolean;
    notes: string | null;
    sortOrder: number;
  }>;
};

export function contactsForDisplay(customer: CustomerWithContactFallback) {
  const contacts = customer.contacts || [];
  if (contacts.length > 0) {
    return contacts
      .slice()
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
  }
  if ([customer.contactName, customer.contactTitle, customer.phone, customer.email, customer.wechatOrWhatsapp].some(Boolean)) {
    return [
      {
        id: "legacy-contact",
        name: customer.contactName || "未填写姓名",
        title: customer.contactTitle || "",
        phone: customer.phone || "",
        email: customer.email || "",
        wechatOrWhatsapp: customer.wechatOrWhatsapp || "",
        isPrimary: true,
        notes: "",
        sortOrder: 0
      }
    ];
  }
  return [];
}

export function primaryContactSummary(customer: CustomerWithContactFallback) {
  return contactsForDisplay(customer)[0] || null;
}

export async function createExportCustomerAction(formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.create");
  const { payload, customFields } = customerPayloadFromForm(formData);
  const ownerUserId = canAssignOwnerServer(actor) ? String(payload.ownerUserId || actor.id) : actor.id;
  const owner = await prisma.user.findFirst({ where: { id: ownerUserId, department: "export", isActive: true } });
  if (!owner) throw new Error("负责业务员无效或已停用。");
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("请填写客户名称。");
  const geo = await resolveCustomerGeoInput(normalizeCustomerGeo({
    countryCode: String(payload.countryCode || ""),
    countryName: String(payload.countryName || ""),
    stateCode: String(payload.stateCode || ""),
    stateName: String(payload.stateName || ""),
    cityName: String(payload.cityName || ""),
    country: String(payload.country || ""),
    city: String(payload.city || "")
  }));
  const customer = await createCustomerWithRetry({
    name,
    customerType: String(payload.customerType || CUSTOMER_TYPES[0]),
    country: geo.country,
    countryCode: geo.countryCode,
    countryName: geo.countryName,
    stateCode: geo.stateCode,
    stateName: geo.stateName,
    cityName: geo.cityName,
    city: geo.city,
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
  const contacts = parseCustomerContacts(formData);
  await prisma.$transaction(async (tx) => {
    await syncCustomerContacts(tx, actor, customer.id, contacts);
    await tx.auditLog.create({
      data: { actorUserId: actor.id, action: "customer.create", entityType: "Customer", entityId: customer.id, metadata: { customerCode: customer.customerCode } }
    });
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
  "use server";

  const actor = await requireCurrentUser();
  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing || !canEditCustomerServer(actor, existing)) throw new Error("当前账号不能编辑该客户。");
  const { payload, customFields } = customerPayloadFromForm(formData);
  const contacts = parseCustomerContacts(formData);
  const ownerUserId = canAssignOwnerServer(actor) ? String(payload.ownerUserId || existing.ownerUserId) : existing.ownerUserId;
  const owner = await prisma.user.findFirst({ where: { id: ownerUserId, department: "export", isActive: true } });
  if (!owner) throw new Error("负责业务员无效或已停用。");
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("请填写客户名称。");
  const geo = await resolveCustomerGeoInput(normalizeCustomerGeo({
    countryCode: String(payload.countryCode || ""),
    countryName: String(payload.countryName || ""),
    stateCode: String(payload.stateCode || ""),
    stateName: String(payload.stateName || ""),
    cityName: String(payload.cityName || ""),
    country: String(payload.country || existing.country),
    city: String(payload.city || existing.city)
  }));
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        name,
        customerType: String(payload.customerType || CUSTOMER_TYPES[0]),
        country: geo.country,
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        stateCode: geo.stateCode,
        stateName: geo.stateName,
        cityName: geo.cityName,
        city: geo.city,
        source: String(payload.source || ""),
        status: String(payload.status || CUSTOMER_STATUSES[0]),
        ownerUserId,
        ownerName: owner.name,
        contactName: String(payload.contactName ?? existing.contactName),
        contactTitle: String(payload.contactTitle ?? existing.contactTitle),
        phone: String(payload.phone ?? existing.phone),
        email: String(payload.email ?? existing.email),
        wechatOrWhatsapp: String(payload.wechatOrWhatsapp ?? existing.wechatOrWhatsapp),
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
    await syncCustomerContacts(tx, actor, customerId, contacts);
    await tx.auditLog.create({
      data: { actorUserId: actor.id, action: "customer.update", entityType: "Customer", entityId: customerId, metadata: {} }
    });
  });
  revalidatePath("/export/customers");
  revalidatePath(`/export/customers/${customerId}`);
  redirect(`/export/customers/${customerId}`);
}

async function syncCustomerContacts(tx: Prisma.TransactionClient, actor: AuthUser, customerId: string, contacts: CustomerContactDraft[]) {
  const existing = await tx.customerContact.findMany({ where: { customerId } });
  const existingById = new Map(existing.map((contact) => [contact.id, contact]));
  const submittedIds = new Set(contacts.map((contact) => contact.id).filter(Boolean));

  await tx.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });

  for (const contact of existing) {
    if (!submittedIds.has(contact.id)) {
      await tx.customerContact.delete({ where: { id: contact.id } });
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "customer_contact.delete", entityType: "CustomerContact", entityId: contact.id, metadata: { customerId, contactId: contact.id } }
      });
    }
  }

  for (const [index, contact] of contacts.entries()) {
    if (contact.id && existingById.has(contact.id)) {
      const before = existingById.get(contact.id)!;
      await tx.customerContact.update({
        where: { id: contact.id },
        data: {
          name: contact.name,
          title: contact.title || null,
          phone: contact.phone || null,
          email: contact.email || null,
          wechatOrWhatsapp: contact.wechatOrWhatsapp || null,
          notes: contact.notes || null,
          isPrimary: Boolean(contact.isPrimary),
          sortOrder: contact.sortOrder ?? index
        }
      });
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "customer_contact.update", entityType: "CustomerContact", entityId: contact.id, metadata: { customerId, contactId: contact.id } }
      });
      if (contact.isPrimary && !before.isPrimary) {
        await tx.auditLog.create({
          data: { actorUserId: actor.id, action: "customer_contact.set_primary", entityType: "CustomerContact", entityId: contact.id, metadata: { customerId, contactId: contact.id } }
        });
      }
    } else {
      const created = await tx.customerContact.create({
        data: {
          customerId,
          name: contact.name,
          title: contact.title || null,
          phone: contact.phone || null,
          email: contact.email || null,
          wechatOrWhatsapp: contact.wechatOrWhatsapp || null,
          notes: contact.notes || null,
          isPrimary: Boolean(contact.isPrimary),
          sortOrder: contact.sortOrder ?? index
        }
      });
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "customer_contact.create", entityType: "CustomerContact", entityId: created.id, metadata: { customerId, contactId: created.id } }
      });
      if (created.isPrimary) {
        await tx.auditLog.create({
          data: { actorUserId: actor.id, action: "customer_contact.set_primary", entityType: "CustomerContact", entityId: created.id, metadata: { customerId, contactId: created.id } }
        });
      }
    }
  }
}

export async function listCustomerContacts(actor: AuthUser, customerId: string) {
  const customer = await getExportCustomerForActor(actor, customerId);
  return contactsForDisplay(customer);
}

export async function createCustomerContact(actor: AuthUser, customerId: string, input: CustomerContactDraft) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户联系人。");
  const [contact] = normalizeCustomerContacts([input]);
  if (!contact) throw new Error("请填写联系人信息。");
  return prisma.$transaction(async (tx) => {
    if (contact.isPrimary) await tx.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });
    const count = await tx.customerContact.count({ where: { customerId } });
    const created = await tx.customerContact.create({ data: { customerId, name: contact.name, title: contact.title || null, phone: contact.phone || null, email: contact.email || null, wechatOrWhatsapp: contact.wechatOrWhatsapp || null, notes: contact.notes || null, isPrimary: contact.isPrimary || count === 0, sortOrder: contact.sortOrder ?? count } });
    await tx.auditLog.create({ data: { actorUserId: actor.id, action: "customer_contact.create", entityType: "CustomerContact", entityId: created.id, metadata: { customerId, contactId: created.id } } });
    return created;
  });
}

export async function updateCustomerContact(actor: AuthUser, customerId: string, contactId: string, input: CustomerContactDraft) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户联系人。");
  const existing = await prisma.customerContact.findFirst({ where: { id: contactId, customerId } });
  if (!existing) throw new Error("联系人不存在。");
  const [contact] = normalizeCustomerContacts([{ ...input, id: contactId }]);
  if (!contact) throw new Error("请填写联系人信息。");
  return prisma.$transaction(async (tx) => {
    if (contact.isPrimary) await tx.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });
    const updated = await tx.customerContact.update({ where: { id: contactId }, data: { name: contact.name, title: contact.title || null, phone: contact.phone || null, email: contact.email || null, wechatOrWhatsapp: contact.wechatOrWhatsapp || null, notes: contact.notes || null, isPrimary: Boolean(contact.isPrimary), sortOrder: contact.sortOrder ?? 0 } });
    await tx.auditLog.create({ data: { actorUserId: actor.id, action: "customer_contact.update", entityType: "CustomerContact", entityId: updated.id, metadata: { customerId, contactId } } });
    return updated;
  });
}

export async function deleteCustomerContact(actor: AuthUser, customerId: string, contactId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户联系人。");
  const existing = await prisma.customerContact.findFirst({ where: { id: contactId, customerId } });
  if (!existing) throw new Error("联系人不存在。");
  await prisma.$transaction(async (tx) => {
    await tx.customerContact.delete({ where: { id: contactId } });
    await tx.auditLog.create({ data: { actorUserId: actor.id, action: "customer_contact.delete", entityType: "CustomerContact", entityId: contactId, metadata: { customerId, contactId } } });
  });
}

export async function setPrimaryCustomerContact(actor: AuthUser, customerId: string, contactId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户联系人。");
  const existing = await prisma.customerContact.findFirst({ where: { id: contactId, customerId } });
  if (!existing) throw new Error("联系人不存在。");
  await prisma.$transaction(async (tx) => {
    await tx.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });
    await tx.customerContact.update({ where: { id: contactId }, data: { isPrimary: true } });
    await tx.auditLog.create({ data: { actorUserId: actor.id, action: "customer_contact.set_primary", entityType: "CustomerContact", entityId: contactId, metadata: { customerId, contactId } } });
  });
}

export async function listCustomerAttachments(actor: AuthUser, customerId: string) {
  const customer = await getExportCustomerForActor(actor, customerId);
  return customer.attachments;
}

export async function createCustomerAttachmentAction(customerId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户附件。");
  const input = normalizeCustomerAttachment({
    attachmentName: String(formData.get("attachmentName") || ""),
    attachmentType: String(formData.get("attachmentType") || "其他"),
    fileUrl: String(formData.get("fileUrl") || ""),
    description: String(formData.get("description") || "")
  });
  if (!input.attachmentName) throw new Error("请填写附件名称。");
  if (!input.fileUrl) throw new Error("请填写附件链接。");
  if (!CUSTOMER_ATTACHMENT_TYPES.includes(input.attachmentType)) throw new Error("附件类型无效。");
  const created = await prisma.customerAttachment.create({
    data: {
      customerId,
      attachmentName: input.attachmentName,
      attachmentType: input.attachmentType,
      fileUrl: input.fileUrl,
      description: input.description,
      storageProvider: "external_url",
      uploadedByUserId: actor.id,
      uploadedByName: actor.name
    }
  });
  await prisma.auditLog.create({
    data: { actorUserId: actor.id, action: "customer_attachment.create", entityType: "CustomerAttachment", entityId: created.id, metadata: { customerId, attachmentId: created.id, attachmentName: created.attachmentName } }
  });
  revalidatePath(`/export/customers/${customerId}`);
  revalidatePath(`/export/customers/${customerId}/edit`);
  redirect(`/export/customers/${customerId}/edit`);
}

export async function updateCustomerAttachmentAction(customerId: string, attachmentId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户附件。");
  const input = normalizeCustomerAttachment({
    attachmentName: String(formData.get("attachmentName") || ""),
    attachmentType: String(formData.get("attachmentType") || "其他"),
    fileUrl: String(formData.get("fileUrl") || ""),
    description: String(formData.get("description") || "")
  });
  if (!input.attachmentName) throw new Error("请填写附件名称。");
  if (!input.fileUrl) throw new Error("请填写附件链接。");
  if (!CUSTOMER_ATTACHMENT_TYPES.includes(input.attachmentType)) throw new Error("附件类型无效。");
  const updated = await prisma.customerAttachment.update({
    where: { id: attachmentId },
    data: {
      attachmentName: input.attachmentName,
      attachmentType: input.attachmentType,
      fileUrl: input.fileUrl,
      description: input.description
    }
  });
  await prisma.auditLog.create({
    data: { actorUserId: actor.id, action: "customer_attachment.update", entityType: "CustomerAttachment", entityId: attachmentId, metadata: { customerId, attachmentId, attachmentName: updated.attachmentName } }
  });
  revalidatePath(`/export/customers/${customerId}`);
  revalidatePath(`/export/customers/${customerId}/edit`);
  redirect(`/export/customers/${customerId}/edit`);
}

export async function deleteCustomerAttachmentAction(customerId: string, attachmentId: string) {
  "use server";

  const actor = await requireCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户附件。");
  const existing = await prisma.customerAttachment.findFirst({ where: { id: attachmentId, customerId, deletedAt: null } });
  if (!existing) throw new Error("附件不存在。");
  const deleted = await prisma.customerAttachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() }
  });
  await prisma.auditLog.create({
    data: { actorUserId: actor.id, action: "customer_attachment.delete", entityType: "CustomerAttachment", entityId: attachmentId, metadata: { customerId, attachmentId, attachmentName: deleted.attachmentName } }
  });
  revalidatePath(`/export/customers/${customerId}`);
  revalidatePath(`/export/customers/${customerId}/edit`);
  redirect(`/export/customers/${customerId}/edit`);
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
