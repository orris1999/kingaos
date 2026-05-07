import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_SYSTEM_FIELD_KEYS,
  CUSTOMER_TYPES
} from "../shared/constants";
import { normalizeCustomerName } from "../shared/customer-name-normalizer";
import { buildCustomerFieldChangeHistoryDrafts, displayHistoryValue, hasMeaningfulFieldChange, historyChangeType, isMeaningfulHistoryRecord } from "../shared/customer-field-history";
import { normalizeCustomerAttachment, normalizeCustomerContacts, type CustomerContactDraft } from "../shared/customer-relations";
import type { CustomerFieldConfig } from "../shared/domain-types";
import { isSafeUrl, normalizeMultiValue, normalizeUrlFieldValue } from "../shared/field-values";
import { customerGeoDisplay, normalizeCustomerGeo } from "../shared/geo";
import type { AuthUser } from "./auth";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser, requireServerPermission } from "./auth";
import { prisma } from "./db";
import { getCustomerAttachmentTypes, mapFieldConfig } from "./field-config";
import { resolveCustomerGeoInput } from "./geo";
import { assertCustomerOssObjectKey, generateGetSignedUrl, validateOssUploadRequest } from "./oss";
import { receiptAccountSelectionForCustomer, receiptAccountSelectionForNewCustomer } from "./receipt-accounts";

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

export function canManageDuplicateReviewServer(actor: AuthUser) {
  return hasServerPermission(actor, "export.customers.duplicate_review.manage");
}

export function canViewDuplicateReviewsServer(actor: AuthUser) {
  return hasAnyServerPermission(actor, ["export.customers.duplicate_review.view", "export.customers.duplicate_review.manage"]);
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
      normalizeMultiValue((customer as unknown as { customerTypes?: unknown }).customerTypes).join(" "),
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
      defaultReceiptAccount: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!customer || !canViewCustomerServer(actor, customer)) throw new Error("当前账号不能查看该客户。");
  return customer;
}

export async function listCustomerFieldChangeHistoryForActor(actor: AuthUser, customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canViewCustomerServer(actor, customer)) throw new Error("当前账号不能查看该客户修改历史。");
  return prisma.customerFieldChangeHistory.findMany({
    where: { customerId },
    orderBy: { changedAt: "desc" },
    take: 100
  }).then((histories) => histories.filter(isMeaningfulHistoryRecord));
}

export async function getExportOwners() {
  return prisma.user.findMany({ where: { department: "export", isActive: true }, orderBy: { name: "asc" } });
}

function customerPayloadFromForm(formData: FormData, fieldConfigs: CustomerFieldConfig[] = []) {
  const payload: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (CUSTOMER_SYSTEM_FIELD_KEYS.has(key) && key !== "customerTypes") payload[key] = normalized;
    else if (key.startsWith("custom_") && !fieldConfigs.some((field) => field.fieldKey === key)) customFields[key] = normalized;
  }
  const customerTypes = normalizeMultiValue(formData.getAll("customerTypes"));
  if (customerTypes.length) {
    payload.customerTypes = customerTypes;
    payload.customerType = customerTypes[0];
  }
  for (const field of fieldConfigs) {
    if (CUSTOMER_SYSTEM_FIELD_KEYS.has(field.fieldKey)) continue;
    if (field.fieldType === "multiselect") {
      customFields[field.fieldKey] = normalizeMultiValue(formData.getAll(field.fieldKey));
      continue;
    }
    if (field.fieldType === "url") {
      const url = String(formData.get(`${field.fieldKey}__url`) || "").trim();
      const label = String(formData.get(`${field.fieldKey}__label`) || "").trim();
      if (url) {
        if (!isSafeUrl(url)) throw new Error(`${field.fieldLabel} 链接地址无效或不安全。`);
        customFields[field.fieldKey] = label ? { label, url } : { url };
      } else {
        customFields[field.fieldKey] = null;
      }
      continue;
    }
    if (field.fieldType === "attachment") {
      customFields[field.fieldKey] = normalizeMultiValue(formData.getAll(`${field.fieldKey}__attachmentId`));
      continue;
    }
    if (field.fieldType === "boolean") {
      const value = String(formData.get(field.fieldKey) || "").trim();
      customFields[field.fieldKey] = value;
      continue;
    }
    customFields[field.fieldKey] = String(formData.get(field.fieldKey) || "").trim();
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

function customerTypesFromPayload(payload: Record<string, unknown>, fallback?: string | null) {
  const values = normalizeMultiValue(payload.customerTypes);
  if (values.length) return values;
  const legacy = normalizeMultiValue(payload.customerType || fallback || "");
  return legacy.length ? legacy : [CUSTOMER_TYPES[0]];
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

type CustomerDraftPayload = {
  operation?: "create" | "update";
  customerId?: string;
  payload: Record<string, unknown>;
  customFields: Record<string, unknown>;
  contacts: CustomerContactDraft[];
  ownerUserId: string;
  requestReason?: string;
};

function duplicateReviewPayload(draft: CustomerDraftPayload): Prisma.InputJsonObject {
  return {
    payload: draft.payload as Prisma.InputJsonObject,
    customFields: draft.customFields as Prisma.InputJsonObject,
    contacts: draft.contacts as unknown as Prisma.InputJsonArray,
    ownerUserId: draft.ownerUserId,
    operation: draft.operation || "create",
    customerId: draft.customerId || "",
    requestReason: draft.requestReason || ""
  };
}

function parseDuplicateReviewPayload(value: Prisma.JsonValue | null): CustomerDraftPayload {
  const data = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  return {
    payload: (data.payload && typeof data.payload === "object" && !Array.isArray(data.payload) ? data.payload : {}) as Record<string, unknown>,
    customFields: (data.customFields && typeof data.customFields === "object" && !Array.isArray(data.customFields) ? data.customFields : {}) as Record<string, unknown>,
    contacts: Array.isArray(data.contacts) ? normalizeCustomerContacts(data.contacts as CustomerContactDraft[]) : [],
    ownerUserId: String(data.ownerUserId || ""),
    operation: data.operation === "update" ? "update" : "create",
    customerId: String(data.customerId || ""),
    requestReason: String(data.requestReason || "")
  };
}

async function existingDuplicateCustomers(normalizedName: string, identityId?: string | null, excludeCustomerId?: string) {
  return prisma.customer.findMany({
    where: {
      department: "export",
      id: excludeCustomerId ? { not: excludeCustomerId } : undefined,
      OR: [
        { normalizedCustomerName: normalizedName },
        identityId ? { customerIdentityId: identityId } : undefined
      ].filter(Boolean) as Prisma.CustomerWhereInput[]
    },
    orderBy: { updatedAt: "desc" },
    take: 10
  });
}

export async function checkCustomerDuplicateName(proposedName: string, excludeCustomerId?: string) {
  const normalizedName = normalizeCustomerName(proposedName);
  if (!normalizedName) return { normalizedName, identity: null, existingCustomers: [], isDuplicate: false };
  const identity = await prisma.customerIdentity.findUnique({
    where: { scope_normalizedName: { scope: "export_customer", normalizedName } }
  });
  const existingCustomers = await existingDuplicateCustomers(normalizedName, identity?.id, excludeCustomerId);
  return { normalizedName, identity, existingCustomers, isDuplicate: existingCustomers.length > 0 };
}

async function findOrCreateCustomerIdentity(displayName: string, normalizedName: string) {
  const existing = await prisma.customerIdentity.findUnique({
    where: { scope_normalizedName: { scope: "export_customer", normalizedName } }
  });
  if (existing) return existing;
  try {
    return await prisma.customerIdentity.create({
      data: { scope: "export_customer", displayName: displayName.trim(), normalizedName }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const identity = await prisma.customerIdentity.findUnique({
      where: { scope_normalizedName: { scope: "export_customer", normalizedName } }
    });
    if (!identity) throw error;
    return identity;
  }
}

async function createDuplicateReviewRequestForDraft(actor: AuthUser, draft: CustomerDraftPayload, normalizedName: string, existingIdentityId: string | null, existingCustomerIds: string[]) {
  const request = await prisma.customerDuplicateReviewRequest.create({
    data: {
      department: "export",
      moduleKey: "export_customer",
      requestedByUserId: actor.id,
      requestedByName: actor.name,
      proposedCustomerName: String(draft.payload.name || "").trim(),
      normalizedName,
      existingIdentityId,
      existingCustomerIds,
      requestedPayload: duplicateReviewPayload(draft),
      requestReason: draft.requestReason || null,
      status: "pending"
    }
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "customer_duplicate_review.submit",
      entityType: "CustomerDuplicateReviewRequest",
      entityId: request.id,
      metadata: { duplicateReviewRequestId: request.id, proposedCustomerName: request.proposedCustomerName, normalizedName, existingCustomerIds, requestedByUserId: actor.id }
    }
  });
  return request;
}

export async function createExportCustomerAction(formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.create");
  const fieldConfigs = (await prisma.customerFieldConfig.findMany({ where: { moduleKey: "export_customer", isActive: true }, orderBy: { sortOrder: "asc" } })).map(mapFieldConfig);
  const { payload, customFields } = customerPayloadFromForm(formData, fieldConfigs);
  const customerTypes = customerTypesFromPayload(payload);
  const ownerUserId = canAssignOwnerServer(actor) ? String(payload.ownerUserId || actor.id) : actor.id;
  const owner = await prisma.user.findFirst({ where: { id: ownerUserId, department: "export", isActive: true } });
  if (!owner) throw new Error("负责业务员无效或已停用。");
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("请填写公司名称。");
  const normalizedCustomerName = normalizeCustomerName(name);
  if (!normalizedCustomerName) throw new Error("请填写有效公司名称。");
  const geo = await resolveCustomerGeoInput(normalizeCustomerGeo({
    countryCode: String(payload.countryCode || ""),
    countryName: String(payload.countryName || ""),
    stateCode: String(payload.stateCode || ""),
    stateName: String(payload.stateName || ""),
    cityName: String(payload.cityName || ""),
    country: String(payload.country || ""),
    city: String(payload.city || "")
  }));
  const contacts = parseCustomerContacts(formData);
  const receiptSelection = await receiptAccountSelectionForNewCustomer(
    actor,
    String(formData.get("defaultReceiptAccountId") || "").trim() || null,
    String(formData.get("defaultReceiptAccountNote") || "").trim() || null
  );
  const draft: CustomerDraftPayload = {
    operation: "create",
    payload,
    customFields: customFields as Prisma.InputJsonObject,
    contacts,
    ownerUserId,
    requestReason: String(formData.get("duplicateReviewReason") || "").trim()
  };
  const duplicate = await checkCustomerDuplicateName(name);
  let identity = duplicate.identity;
  let duplicateApprovalRequestId: string | null = null;
  let duplicateApprovalStatus = "none";
  let duplicateApprovedByUserId: string | null = null;
  let duplicateApprovedByName: string | null = null;
  let duplicateApprovedAt: Date | null = null;
  let duplicateApprovalReason: string | null = null;
  const existingCustomerIds = duplicate.existingCustomers.map((customer) => customer.id);
  if (duplicate.isDuplicate) {
    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_duplicate.detected",
        entityType: "CustomerIdentity",
        entityId: duplicate.identity?.id || null,
        metadata: { proposedCustomerName: name, normalizedName: normalizedCustomerName, existingCustomerIds, requestedByUserId: actor.id }
      }
    });
    const managerDirectApproval = canManageDuplicateReviewServer(actor) && formData.get("duplicateApprovalConfirmed") === "1";
    if (!managerDirectApproval) {
      const request = await createDuplicateReviewRequestForDraft(actor, draft, normalizedCustomerName, duplicate.identity?.id || null, existingCustomerIds);
      revalidatePath("/export/customers/duplicate-reviews");
      redirect(`/export/customers/duplicate-reviews/${request.id}?submitted=1`);
    }
    if (!draft.requestReason) throw new Error("重复客户例外建档必须填写审核原因。");
    identity = identity || await findOrCreateCustomerIdentity(name, normalizedCustomerName);
    const request = await prisma.customerDuplicateReviewRequest.create({
      data: {
        department: "export",
        moduleKey: "export_customer",
        requestedByUserId: actor.id,
        requestedByName: actor.name,
        proposedCustomerName: name,
        normalizedName: normalizedCustomerName,
        existingIdentityId: identity.id,
        existingCustomerIds,
        requestedPayload: duplicateReviewPayload(draft),
        requestReason: draft.requestReason,
        status: "approved",
        decidedByUserId: actor.id,
        decidedByName: actor.name,
        decisionNote: draft.requestReason,
        decidedAt: new Date()
      }
    });
    duplicateApprovalRequestId = request.id;
    duplicateApprovalStatus = "approved_duplicate";
    duplicateApprovedByUserId = actor.id;
    duplicateApprovedByName = actor.name;
    duplicateApprovedAt = new Date();
    duplicateApprovalReason = draft.requestReason;
  } else {
    identity = await findOrCreateCustomerIdentity(name, normalizedCustomerName);
  }
  const customer = await createCustomerWithRetry({
    name,
    customerIdentityId: identity.id,
    normalizedCustomerName,
    duplicateApprovalStatus,
    duplicateApprovalRequestId,
    duplicateApprovedByUserId,
    duplicateApprovedByName,
    duplicateApprovedAt,
    duplicateApprovalReason,
    defaultReceiptAccountId: receiptSelection.accountId,
    defaultReceiptAccountSelectedAt: receiptSelection.accountId ? new Date() : null,
    defaultReceiptAccountSelectedByUserId: receiptSelection.accountId ? actor.id : null,
    defaultReceiptAccountSelectedByName: receiptSelection.accountId ? actor.name : null,
    defaultReceiptAccountNote: receiptSelection.note,
    customerType: customerTypes[0],
    customerTypes,
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
    customFields: customFields as Prisma.InputJsonObject,
    createdByUserId: actor.id
  });
  await prisma.$transaction(async (tx) => {
    await syncCustomerContacts(tx, actor, customer.id, contacts);
    await tx.auditLog.create({
      data: { actorUserId: actor.id, action: "customer.create", entityType: "Customer", entityId: customer.id, metadata: { customerCode: customer.customerCode, customerIdentityId: identity.id, normalizedName: normalizedCustomerName } }
    });
    if (duplicateApprovalRequestId) {
      await tx.customerDuplicateReviewRequest.update({ where: { id: duplicateApprovalRequestId }, data: { createdCustomerId: customer.id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "customer_duplicate_review.direct_approve_and_create",
          entityType: "CustomerDuplicateReviewRequest",
          entityId: duplicateApprovalRequestId,
          metadata: { customerId: customer.id, customerIdentityId: identity.id, duplicateReviewRequestId: duplicateApprovalRequestId, proposedCustomerName: name, normalizedName: normalizedCustomerName, existingCustomerIds, decidedByUserId: actor.id, decisionNote: duplicateApprovalReason }
        }
      });
    }
    if (receiptSelection.accountId) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "customer.receipt_account.select",
          entityType: "Customer",
          entityId: customer.id,
          metadata: {
            customerId: customer.id,
            oldReceiptAccountId: null,
            newReceiptAccountId: receiptSelection.accountId,
            actorUserId: actor.id
          }
        }
      });
    }
  });
  revalidatePath("/export/customers");
  redirect(`/export/customers/${customer.id}`);
}

async function createCustomerWithRetry(data: Omit<Prisma.CustomerUncheckedCreateInput, "id" | "customerCode" | "createdAt" | "updatedAt">) {
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

function recordFromJson(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function historyJsonValue(value: unknown) {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

async function createAttachmentFieldHistoryIfNeeded(
  tx: Prisma.TransactionClient,
  actor: AuthUser,
  customerId: string,
  fieldKey: string | null,
  fieldLabel: string | null,
  oldIds: string[],
  newIds: string[]
) {
  if (!fieldKey || !hasMeaningfulFieldChange(oldIds, newIds, "attachment")) return;
  await tx.customerFieldChangeHistory.create({
    data: {
      customerId,
      fieldKey,
      fieldLabel: fieldLabel || fieldKey,
      fieldKind: "custom",
      fieldType: "attachment",
      oldValue: historyJsonValue(oldIds),
      newValue: historyJsonValue(newIds),
      oldDisplayValue: displayHistoryValue(oldIds, "attachment"),
      newDisplayValue: displayHistoryValue(newIds, "attachment"),
      changeType: historyChangeType(oldIds, newIds),
      source: "customer_edit",
      changedByUserId: actor.id,
      changedByName: actor.name,
      metadata: { fieldKey }
    }
  });
}

function receiptAccountSummary(account?: { id: string; displayName: string; accountCode: string } | null) {
  return account ? { id: account.id, displayName: account.displayName, accountCode: account.accountCode } : null;
}

export async function updateExportCustomerAction(customerId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing || !canEditCustomerServer(actor, existing)) throw new Error("当前账号不能编辑该客户。");
  const fieldConfigs = (await prisma.customerFieldConfig.findMany({ where: { moduleKey: "export_customer", isActive: true }, orderBy: { sortOrder: "asc" } })).map(mapFieldConfig);
  const parsedForm = customerPayloadFromForm(formData, fieldConfigs);
  const payload = parsedForm.payload;
  const customFields = { ...recordFromJson(existing.customFields), ...parsedForm.customFields };
  const customerTypes = customerTypesFromPayload(payload, existing.customerType);
  const contacts = parseCustomerContacts(formData);
  const canSelectReceiptAccount = hasServerPermission(actor, "export.customers.receipt_account.select");
  const receiptSelection = canSelectReceiptAccount
    ? await receiptAccountSelectionForCustomer(
        actor,
        customerId,
        String(formData.get("defaultReceiptAccountId") || "").trim() || null,
        String(formData.get("defaultReceiptAccountNote") || "").trim() || null,
        existing.defaultReceiptAccountId
      )
    : { accountId: existing.defaultReceiptAccountId, note: existing.defaultReceiptAccountNote };
  const ownerUserId = canAssignOwnerServer(actor) ? String(payload.ownerUserId || existing.ownerUserId) : existing.ownerUserId;
  const owner = await prisma.user.findFirst({ where: { id: ownerUserId, department: "export", isActive: true } });
  if (!owner) throw new Error("负责业务员无效或已停用。");
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("请填写公司名称。");
  const normalizedCustomerName = normalizeCustomerName(name);
  if (!normalizedCustomerName) throw new Error("请填写有效公司名称。");
  const previousNormalizedName = existing.normalizedCustomerName || normalizeCustomerName(existing.name);
  const duplicate = await checkCustomerDuplicateName(name, customerId);
  if (normalizedCustomerName !== previousNormalizedName && duplicate.isDuplicate) {
    const draft: CustomerDraftPayload = {
      operation: "update",
      customerId,
      payload,
      customFields,
      contacts,
      ownerUserId,
      requestReason: String(formData.get("duplicateReviewReason") || "").trim()
    };
    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_duplicate.detected",
        entityType: "Customer",
        entityId: customerId,
        metadata: { customerId, proposedCustomerName: name, normalizedName: normalizedCustomerName, existingCustomerIds: duplicate.existingCustomers.map((customer) => customer.id), requestedByUserId: actor.id }
      }
    });
    const request = await createDuplicateReviewRequestForDraft(actor, draft, normalizedCustomerName, duplicate.identity?.id || null, duplicate.existingCustomers.map((customer) => customer.id));
    revalidatePath("/export/customers/duplicate-reviews");
    redirect(`/export/customers/duplicate-reviews/${request.id}?submitted=1`);
  }
  const identity =
    normalizedCustomerName === previousNormalizedName && existing.customerIdentityId
      ? await prisma.customerIdentity.findUnique({ where: { id: existing.customerIdentityId } }) || await findOrCreateCustomerIdentity(name, normalizedCustomerName)
      : duplicate.identity || await findOrCreateCustomerIdentity(name, normalizedCustomerName);
  const geo = await resolveCustomerGeoInput(normalizeCustomerGeo({
    countryCode: String(payload.countryCode || ""),
    countryName: String(payload.countryName || ""),
    stateCode: String(payload.stateCode || ""),
    stateName: String(payload.stateName || ""),
    cityName: String(payload.cityName || ""),
    country: String(payload.country || existing.country),
    city: String(payload.city || existing.city)
  }));
  const [receiptAccounts] = await Promise.all([
    prisma.companyReceiptAccount.findMany({
      where: {
        id: {
          in: Array.from(new Set([existing.defaultReceiptAccountId, receiptSelection.accountId].filter(Boolean) as string[]))
        }
      }
    })
  ]);
  const receiptAccountById = new Map(receiptAccounts.map((account) => [account.id, account]));
  const nextCustomerForHistory = {
    ...existing,
    status: String(payload.status || CUSTOMER_STATUSES[0]),
    mainProducts: String(payload.mainProducts || ""),
    purchaseNeed: String(payload.purchaseNeed || ""),
    expectedPurchaseNeed: String(payload.expectedPurchaseNeed || ""),
    sourceNote: String(payload.sourceNote || ""),
    customerNotes: String(payload.customerNotes || ""),
    internalNotes: String(payload.internalNotes || ""),
    specialReminder: String(payload.specialReminder || ""),
    defaultReceiptAccountId: receiptSelection.accountId
  };
  const fieldHistoryDrafts = buildCustomerFieldChangeHistoryDrafts({
    oldCustomer: existing as unknown as Record<string, unknown>,
    newCustomer: nextCustomerForHistory as unknown as Record<string, unknown>,
    oldCustomFields: recordFromJson(existing.customFields),
    newCustomFields: customFields,
    fieldConfigs,
    oldReceiptAccount: receiptAccountSummary(existing.defaultReceiptAccountId ? receiptAccountById.get(existing.defaultReceiptAccountId) : null),
    newReceiptAccount: receiptAccountSummary(receiptSelection.accountId ? receiptAccountById.get(receiptSelection.accountId) : null)
  });
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        name,
        customerIdentityId: identity.id,
        normalizedCustomerName,
        customerType: customerTypes[0],
        customerTypes,
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
        companyName: Object.hasOwn(payload, "companyName") ? String(payload.companyName || "") : existing.companyName,
        companyWebsite: String(payload.companyWebsite || ""),
        companyAddress: String(payload.companyAddress || ""),
        mainProducts: String(payload.mainProducts || ""),
        purchaseNeed: String(payload.purchaseNeed || ""),
        sourceNote: String(payload.sourceNote || ""),
        expectedPurchaseNeed: String(payload.expectedPurchaseNeed || ""),
        customerNotes: String(payload.customerNotes || ""),
        internalNotes: String(payload.internalNotes || ""),
        specialReminder: String(payload.specialReminder || ""),
        customFields: customFields as Prisma.InputJsonObject,
        defaultReceiptAccountId: receiptSelection.accountId,
        defaultReceiptAccountSelectedAt: receiptSelection.accountId !== existing.defaultReceiptAccountId ? new Date() : existing.defaultReceiptAccountSelectedAt,
        defaultReceiptAccountSelectedByUserId: receiptSelection.accountId !== existing.defaultReceiptAccountId ? actor.id : existing.defaultReceiptAccountSelectedByUserId,
        defaultReceiptAccountSelectedByName: receiptSelection.accountId !== existing.defaultReceiptAccountId ? actor.name : existing.defaultReceiptAccountSelectedByName,
        defaultReceiptAccountNote: receiptSelection.note
      }
    });
    await syncCustomerContacts(tx, actor, customerId, contacts);
    await tx.auditLog.create({
      data: { actorUserId: actor.id, action: "customer.update", entityType: "Customer", entityId: customerId, metadata: { customerIdentityId: identity.id, normalizedName: normalizedCustomerName } }
    });
    if (normalizedCustomerName !== previousNormalizedName) {
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "customer_identity.change", entityType: "Customer", entityId: customerId, metadata: { customerId, customerIdentityId: identity.id, normalizedName: normalizedCustomerName } }
      });
    }
    if (receiptSelection.accountId !== existing.defaultReceiptAccountId) {
      const action = receiptSelection.accountId ? (existing.defaultReceiptAccountId ? "customer.receipt_account.change" : "customer.receipt_account.select") : "customer.receipt_account.clear";
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action,
          entityType: "Customer",
          entityId: customerId,
          metadata: {
            customerId,
            oldReceiptAccountId: existing.defaultReceiptAccountId,
            newReceiptAccountId: receiptSelection.accountId,
            actorUserId: actor.id
          }
        }
      });
    }
    for (const history of fieldHistoryDrafts) {
      await tx.customerFieldChangeHistory.create({
        data: {
          customerId,
          fieldKey: history.fieldKey,
          fieldLabel: history.fieldLabel,
          fieldGroup: history.fieldGroup || null,
          fieldKind: history.fieldKind,
          fieldType: history.fieldType || null,
          oldValue: historyJsonValue(history.oldValue),
          newValue: historyJsonValue(history.newValue),
          oldDisplayValue: history.oldDisplayValue,
          newDisplayValue: history.newDisplayValue,
          changeType: history.changeType,
          source: history.source,
          changedByUserId: actor.id,
          changedByName: actor.name,
          metadata: history.metadata || Prisma.JsonNull
        }
      });
    }
  });
  revalidatePath("/export/customers");
  revalidatePath(`/export/customers/${customerId}`);
  redirect(`/export/customers/${customerId}`);
}

export async function listCustomerDuplicateReviewRequestsForActor(actor: AuthUser) {
  const where = canViewDuplicateReviewsServer(actor)
    ? { department: "export" }
    : { department: "export", requestedByUserId: actor.id };
  return prisma.customerDuplicateReviewRequest.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function getCustomerDuplicateReviewRequestForActor(actor: AuthUser, requestId: string) {
  const request = await prisma.customerDuplicateReviewRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("重复客户审核申请不存在。");
  if (!canViewDuplicateReviewsServer(actor) && request.requestedByUserId !== actor.id) {
    throw new Error("当前账号不能查看该重复客户审核申请。");
  }
  const existingCustomerIds = Array.isArray(request.existingCustomerIds) ? request.existingCustomerIds.map(String) : [];
  const existingCustomers = existingCustomerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: existingCustomerIds }, department: "export" },
        orderBy: { updatedAt: "desc" }
      })
    : [];
  return { request, existingCustomers, requestedPayload: parseDuplicateReviewPayload(request.requestedPayload) };
}

export async function approveCustomerDuplicateReviewRequestAction(requestId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.duplicate_review.manage");
  const decisionNote = String(formData.get("decisionNote") || "").trim();
  if (!decisionNote) throw new Error("请填写审核原因。");
  const request = await prisma.customerDuplicateReviewRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "pending") throw new Error("审核申请不存在或已处理。");
  if (request.requestedByUserId === actor.id) throw new Error("不能审核自己的重复客户申请。");
  const draft = parseDuplicateReviewPayload(request.requestedPayload);
  const customer = draft.operation === "update" && draft.customerId
    ? await approveDuplicateNameUpdate(actor, request, draft, decisionNote)
    : await approveDuplicateCustomerCreate(actor, request, draft, decisionNote);
  revalidatePath("/export/customers");
  revalidatePath("/export/customers/duplicate-reviews");
  revalidatePath(`/export/customers/duplicate-reviews/${requestId}`);
  redirect(`/export/customers/${customer.id}`);
}

export async function rejectCustomerDuplicateReviewRequestAction(requestId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.duplicate_review.manage");
  const decisionNote = String(formData.get("decisionNote") || "").trim();
  if (!decisionNote) throw new Error("请填写拒绝原因。");
  const request = await prisma.customerDuplicateReviewRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "pending") throw new Error("审核申请不存在或已处理。");
  if (request.requestedByUserId === actor.id) throw new Error("不能审核自己的重复客户申请。");
  await prisma.$transaction(async (tx) => {
    await tx.customerDuplicateReviewRequest.update({
      where: { id: requestId },
      data: { status: "rejected", decidedByUserId: actor.id, decidedByName: actor.name, decisionNote, decidedAt: new Date() }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_duplicate_review.reject",
        entityType: "CustomerDuplicateReviewRequest",
        entityId: requestId,
        metadata: { duplicateReviewRequestId: requestId, proposedCustomerName: request.proposedCustomerName, normalizedName: request.normalizedName, requestedByUserId: request.requestedByUserId, decidedByUserId: actor.id, decisionNote }
      }
    });
  });
  revalidatePath("/export/customers/duplicate-reviews");
  revalidatePath(`/export/customers/duplicate-reviews/${requestId}`);
  redirect(`/export/customers/duplicate-reviews/${requestId}`);
}

async function approveDuplicateCustomerCreate(actor: AuthUser, request: { id: string; normalizedName: string; proposedCustomerName: string; existingIdentityId: string | null; requestedByUserId: string }, draft: CustomerDraftPayload, decisionNote: string) {
  const payload = draft.payload;
  const ownerUserId = draft.ownerUserId || String(payload.ownerUserId || request.requestedByUserId);
  const owner = await prisma.user.findFirst({ where: { id: ownerUserId, department: "export", isActive: true } });
  if (!owner) throw new Error("负责业务员无效或已停用。");
  const name = String(payload.name || request.proposedCustomerName).trim();
  const normalizedCustomerName = normalizeCustomerName(name);
  const identity = request.existingIdentityId
    ? await prisma.customerIdentity.findUnique({ where: { id: request.existingIdentityId } }) || await findOrCreateCustomerIdentity(name, normalizedCustomerName)
    : await findOrCreateCustomerIdentity(name, normalizedCustomerName);
  const geo = await resolveCustomerGeoInput(normalizeCustomerGeo({
    countryCode: String(payload.countryCode || ""),
    countryName: String(payload.countryName || ""),
    stateCode: String(payload.stateCode || ""),
    stateName: String(payload.stateName || ""),
    cityName: String(payload.cityName || ""),
    country: String(payload.country || ""),
    city: String(payload.city || "")
  }));
  const receiptSelection = await receiptAccountSelectionForNewCustomer(
    actor,
    String(payload.defaultReceiptAccountId || "").trim() || null,
    String(payload.defaultReceiptAccountNote || "").trim() || null
  );
  const customerTypes = customerTypesFromPayload(payload);
  const customer = await createCustomerWithRetry({
    name,
    customerIdentityId: identity.id,
    normalizedCustomerName,
    duplicateApprovalStatus: "approved_duplicate",
    duplicateApprovalRequestId: request.id,
    duplicateApprovedByUserId: actor.id,
    duplicateApprovedByName: actor.name,
    duplicateApprovedAt: new Date(),
    duplicateApprovalReason: decisionNote,
    defaultReceiptAccountId: receiptSelection.accountId,
    defaultReceiptAccountSelectedAt: receiptSelection.accountId ? new Date() : null,
    defaultReceiptAccountSelectedByUserId: receiptSelection.accountId ? actor.id : null,
    defaultReceiptAccountSelectedByName: receiptSelection.accountId ? actor.name : null,
    defaultReceiptAccountNote: receiptSelection.note,
    customerType: customerTypes[0],
    customerTypes,
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
    customFields: draft.customFields as Prisma.InputJsonObject,
    createdByUserId: request.requestedByUserId
  });
  await prisma.$transaction(async (tx) => {
    await syncCustomerContacts(tx, actor, customer.id, draft.contacts);
    await tx.customerDuplicateReviewRequest.update({
      where: { id: request.id },
      data: { status: "approved", decidedByUserId: actor.id, decidedByName: actor.name, decisionNote, decidedAt: new Date(), createdCustomerId: customer.id }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_duplicate_review.approve_and_create",
        entityType: "CustomerDuplicateReviewRequest",
        entityId: request.id,
        metadata: { customerId: customer.id, customerIdentityId: identity.id, duplicateReviewRequestId: request.id, proposedCustomerName: name, normalizedName: normalizedCustomerName, requestedByUserId: request.requestedByUserId, decidedByUserId: actor.id, decisionNote }
      }
    });
    if (receiptSelection.accountId) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "customer.receipt_account.select",
          entityType: "Customer",
          entityId: customer.id,
          metadata: {
            customerId: customer.id,
            oldReceiptAccountId: null,
            newReceiptAccountId: receiptSelection.accountId,
            actorUserId: actor.id
          }
        }
      });
    }
  });
  return customer;
}

async function approveDuplicateNameUpdate(actor: AuthUser, request: { id: string; normalizedName: string; proposedCustomerName: string; existingIdentityId: string | null; requestedByUserId: string }, draft: CustomerDraftPayload, decisionNote: string) {
  const customer = await prisma.customer.findUnique({ where: { id: draft.customerId } });
  if (!customer) throw new Error("待修改客户不存在。");
  const payload = draft.payload;
  const name = String(payload.name || request.proposedCustomerName).trim();
  const normalizedCustomerName = normalizeCustomerName(name);
  const identity = request.existingIdentityId
    ? await prisma.customerIdentity.findUnique({ where: { id: request.existingIdentityId } }) || await findOrCreateCustomerIdentity(name, normalizedCustomerName)
    : await findOrCreateCustomerIdentity(name, normalizedCustomerName);
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name,
      customerIdentityId: identity.id,
      normalizedCustomerName,
      duplicateApprovalStatus: "approved_duplicate",
      duplicateApprovalRequestId: request.id,
      duplicateApprovedByUserId: actor.id,
      duplicateApprovedByName: actor.name,
      duplicateApprovedAt: new Date(),
      duplicateApprovalReason: decisionNote
    }
  });
  await prisma.$transaction(async (tx) => {
    await tx.customerDuplicateReviewRequest.update({
      where: { id: request.id },
      data: { status: "approved", decidedByUserId: actor.id, decidedByName: actor.name, decisionNote, decidedAt: new Date(), createdCustomerId: updated.id }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_identity.change",
        entityType: "Customer",
        entityId: updated.id,
        metadata: { customerId: updated.id, customerIdentityId: identity.id, duplicateReviewRequestId: request.id, proposedCustomerName: name, normalizedName: normalizedCustomerName, requestedByUserId: request.requestedByUserId, decidedByUserId: actor.id, decisionNote }
      }
    });
  });
  return updated;
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

  return createCustomerAttachmentFromForm(customerId, null, null, formData);
}

export async function createCustomerFieldAttachmentAction(customerId: string, fieldKey: string, fieldLabel: string, formData: FormData) {
  "use server";

  return createCustomerAttachmentFromForm(customerId, fieldKey, fieldLabel, formData);
}

async function createCustomerAttachmentFromForm(customerId: string, forcedFieldKey: string | null, forcedFieldLabel: string | null, formData: FormData) {
  const actor = await requireCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户附件。");
  const input = normalizeCustomerAttachment({
    attachmentName: String(formData.get("attachmentName") || ""),
    attachmentType: String(formData.get("attachmentType") || "其他"),
    fileUrl: String(formData.get("fileUrl") || ""),
    description: String(formData.get("description") || "")
  });
  const fieldKey = forcedFieldKey || String(formData.get("fieldKey") || "").trim() || null;
  const fieldLabel = forcedFieldLabel || String(formData.get("fieldLabel") || "").trim() || null;
  if (!input.attachmentName) throw new Error("请填写附件名称。");
  if (!input.fileUrl) throw new Error("请填写附件链接。");
  if (!(await getCustomerAttachmentTypes()).includes(input.attachmentType)) throw new Error("附件类型无效。");
  const created = await prisma.$transaction(async (tx) => {
    const attachment = await tx.customerAttachment.create({
      data: {
        customerId,
        attachmentName: input.attachmentName,
        attachmentType: input.attachmentType,
        fieldKey,
        fieldLabel,
        fileUrl: input.fileUrl,
        description: input.description,
        storageProvider: "external_url",
        uploadedByUserId: actor.id,
        uploadedByName: actor.name
      }
    });
    if (fieldKey) {
      const customFields = recordFromJson(customer.customFields);
      const currentIds = Array.isArray(customFields[fieldKey]) ? customFields[fieldKey].map(String) : [];
      const nextIds = Array.from(new Set([...currentIds, attachment.id]));
      await tx.customer.update({
        where: { id: customerId },
        data: { customFields: { ...customFields, [fieldKey]: nextIds } as Prisma.InputJsonObject }
      });
      await createAttachmentFieldHistoryIfNeeded(tx, actor, customerId, fieldKey, fieldLabel, currentIds, nextIds);
    }
    await tx.auditLog.create({
      data: { actorUserId: actor.id, action: "customer_attachment.create", entityType: "CustomerAttachment", entityId: attachment.id, metadata: { customerId, attachmentId: attachment.id, attachmentName: attachment.attachmentName, storageProvider: "external_url", fieldKey, fieldLabel } }
    });
    return attachment;
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
  const existing = await prisma.customerAttachment.findFirst({ where: { id: attachmentId, customerId, deletedAt: null } });
  if (!existing) throw new Error("附件不存在。");
  const input = normalizeCustomerAttachment({
    attachmentName: String(formData.get("attachmentName") || ""),
    attachmentType: String(formData.get("attachmentType") || "其他"),
    fileUrl: String(formData.get("fileUrl") || ""),
    description: String(formData.get("description") || "")
  });
  if (!input.attachmentName) throw new Error("请填写附件名称。");
  if (existing.storageProvider !== "aliyun_oss" && !input.fileUrl) throw new Error("请填写附件链接。");
  if (!(await getCustomerAttachmentTypes()).includes(input.attachmentType)) throw new Error("附件类型无效。");
  const updated = await prisma.customerAttachment.update({
    where: { id: attachmentId },
    data: {
      attachmentName: input.attachmentName,
      attachmentType: input.attachmentType,
      fileUrl: existing.storageProvider === "aliyun_oss" ? existing.fileUrl : input.fileUrl,
      description: input.description
    }
  });
  await prisma.auditLog.create({
    data: { actorUserId: actor.id, action: "customer_attachment.update", entityType: "CustomerAttachment", entityId: attachmentId, metadata: { customerId, attachmentId, attachmentName: updated.attachmentName, storageProvider: updated.storageProvider, storageKey: updated.storageKey, fileSize: updated.fileSize, mimeType: updated.mimeType } }
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
  const deleted = await prisma.$transaction(async (tx) => {
    const item = await tx.customerAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() }
    });
    if (item.fieldKey) {
      const fieldKey = item.fieldKey;
      const customFields = recordFromJson(customer.customFields);
      const currentIds = Array.isArray(customFields[fieldKey]) ? (customFields[fieldKey] as unknown[]).map(String) : [];
      const nextIds = currentIds.filter((id) => id !== attachmentId);
      await tx.customer.update({
        where: { id: customerId },
        data: { customFields: { ...customFields, [fieldKey]: nextIds } as Prisma.InputJsonObject }
      });
      await createAttachmentFieldHistoryIfNeeded(tx, actor, customerId, fieldKey, item.fieldLabel, currentIds, nextIds);
    }
    await tx.auditLog.create({
      data: { actorUserId: actor.id, action: "customer_attachment.delete", entityType: "CustomerAttachment", entityId: attachmentId, metadata: { customerId, attachmentId, attachmentName: item.attachmentName, storageProvider: item.storageProvider, storageKey: item.storageKey, fileSize: item.fileSize, mimeType: item.mimeType, fieldKey: item.fieldKey, fieldLabel: item.fieldLabel } }
    });
    return item;
  });
  revalidatePath(`/export/customers/${customerId}`);
  revalidatePath(`/export/customers/${customerId}/edit`);
  redirect(`/export/customers/${customerId}/edit`);
}

export type OssAttachmentInput = {
  attachmentName: string;
  attachmentType?: string;
  fieldKey?: string;
  fieldLabel?: string;
  objectKey: string;
  mimeType: string;
  fileSize: number;
  description?: string;
};

export async function createCustomerAttachmentFromOss(actor: AuthUser, customerId: string, input: OssAttachmentInput) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) throw new Error("当前账号不能维护该客户附件。");
  const attachmentName = String(input.attachmentName || "").trim();
  const attachmentType = String(input.attachmentType || "其他").trim() || "其他";
  const fieldKey = String(input.fieldKey || "").trim() || null;
  const fieldLabel = String(input.fieldLabel || "").trim() || null;
  const description = String(input.description || "").trim();
  const storageKey = assertCustomerOssObjectKey(customerId, input.objectKey);
  const validated = validateOssUploadRequest({
    fileName: attachmentName || storageKey.split("/").pop() || "file",
    fileSize: input.fileSize,
    mimeType: input.mimeType
  });
  if (!attachmentName) throw new Error("请填写附件名称。");
  if (!(await getCustomerAttachmentTypes()).includes(attachmentType)) throw new Error("附件类型无效。");
  const created = await prisma.$transaction(async (tx) => {
    const attachment = await tx.customerAttachment.create({
      data: {
        customerId,
        attachmentName,
        attachmentType,
        fieldKey,
        fieldLabel,
        fileUrl: null,
        description,
        storageProvider: "aliyun_oss",
        storageKey,
        mimeType: validated.mimeType,
        fileSize: validated.fileSize,
        uploadedByUserId: actor.id,
        uploadedByName: actor.name
      }
    });
    if (fieldKey) {
      const customFields = recordFromJson(customer.customFields);
      const currentIds = Array.isArray(customFields[fieldKey]) ? customFields[fieldKey].map(String) : [];
      const nextIds = Array.from(new Set([...currentIds, attachment.id]));
      await tx.customer.update({
        where: { id: customerId },
        data: { customFields: { ...customFields, [fieldKey]: nextIds } as Prisma.InputJsonObject }
      });
      await createAttachmentFieldHistoryIfNeeded(tx, actor, customerId, fieldKey, fieldLabel, currentIds, nextIds);
    }
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_attachment.oss_create",
        entityType: "CustomerAttachment",
        entityId: attachment.id,
        metadata: {
          customerId,
          attachmentId: attachment.id,
          attachmentName: attachment.attachmentName,
          storageProvider: attachment.storageProvider,
          storageKey: attachment.storageKey,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          fieldKey,
          fieldLabel
        }
      }
    });
    return attachment;
  });
  revalidatePath(`/export/customers/${customerId}`);
  revalidatePath(`/export/customers/${customerId}/edit`);
  return created;
}

export async function getCustomerAttachmentDownloadUrl(actor: AuthUser, customerId: string, attachmentId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canViewCustomerServer(actor, customer)) throw new Error("当前账号不能查看该客户附件。");
  const attachment = await prisma.customerAttachment.findFirst({ where: { id: attachmentId, customerId, deletedAt: null } });
  if (!attachment) throw new Error("附件不存在。");
  if (attachment.storageProvider === "external_url") {
    return { downloadUrl: attachment.fileUrl || "", expiresAt: null, storageProvider: "external_url" };
  }
  if (attachment.storageProvider !== "aliyun_oss" || !attachment.storageKey) throw new Error("附件存储信息无效。");
  assertCustomerOssObjectKey(customerId, attachment.storageKey);
  const signed = generateGetSignedUrl(attachment.storageKey);
  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "customer_attachment.download_url.generate",
      entityType: "CustomerAttachment",
      entityId: attachment.id,
      metadata: {
        customerId,
        attachmentId,
        attachmentName: attachment.attachmentName,
        storageProvider: attachment.storageProvider,
        storageKey: attachment.storageKey,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType
      }
    }
  });
  return { ...signed, storageProvider: "aliyun_oss" };
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
