import {
  CUSTOMER_STATUSES,
  CUSTOMER_SYSTEM_FIELD_KEYS,
  CUSTOMER_TYPES
} from "../shared/constants";
import type { ExportCustomer, ExportCustomerInput, User } from "../shared/domain-types";
import type { CustomerDuplicateReviewRequest, CustomerIdentity } from "../shared/domain-types";
import { normalizeCustomerName } from "../shared/customer-name-normalizer";
import { DuplicateCustomerNameError } from "../shared/errors";
import { customerGeoDisplay, normalizeCustomerGeo } from "../shared/geo";
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

export function canManageDuplicateReview(store: KingaStore, actor: User): boolean {
  return hasPermission(store, actor, "export.customers.duplicate_review.manage");
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
      customerGeoDisplay(customer).full,
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
  return createExportCustomerInternal(store, actor, input, {});
}

type ApprovedDuplicateContext = {
  reviewRequestId?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  reason?: string;
};

function createExportCustomerInternal(
  store: KingaStore,
  actor: User,
  input: ExportCustomerInput,
  approvedDuplicate: ApprovedDuplicateContext
): ExportCustomer {
  if (!hasPermission(store, actor, "export.customers.create")) throw new Error("当前账号没有新建出口部客户的权限。");
  const ownerUserId = canAssignCustomerOwner(store, actor) ? input.ownerUserId || actor.id : actor.id;
  if (!canAssignCustomerOwner(store, actor) && input.ownerUserId && input.ownerUserId !== actor.id) {
    throw new Error("业务员只能把客户分配给自己。");
  }
  const owner = store.getUsers().find((user) => user.id === ownerUserId && user.department === "export" && user.isActive);
  if (!owner) throw new Error("负责业务员无效或已停用。");
  if (!input.name.trim()) throw new Error("请填写客户名称。");
  const normalizedCustomerName = normalizeCustomerName(input.name);
  if (!normalizedCustomerName) throw new Error("请填写有效客户名称。");
  const duplicate = checkCustomerDuplicateName(store, input.name);
  const mayApproveDuplicate = canManageDuplicateReview(store, actor) && input.allowDuplicateWithApproval && input.duplicateApprovalReason?.trim();
  if (duplicate.isDuplicate && !approvedDuplicate.reviewRequestId && !mayApproveDuplicate) {
    const request = createCustomerDuplicateReviewRequest(store, actor, { ...input, ownerUserId }, input.duplicateApprovalReason || "");
    throw new DuplicateCustomerNameError("客户名称已存在，已提交重复客户审核申请。", request.id);
  }
  const identity = duplicate.identity || ensureCustomerIdentity(store, input.name, normalizedCustomerName);

  const now = nowIso();
  const geo = normalizeCustomerGeo(input);
  const customer: ExportCustomer = {
    id: newId("cus"),
    customerCode: nextCustomerCode(store),
    name: input.name.trim(),
    customerIdentityId: identity.id,
    normalizedCustomerName,
    duplicateApprovalStatus: duplicate.isDuplicate || approvedDuplicate.reviewRequestId ? "approved_duplicate" : "none",
    duplicateApprovalRequestId: approvedDuplicate.reviewRequestId || null,
    duplicateApprovedByUserId: approvedDuplicate.approvedByUserId || (mayApproveDuplicate ? actor.id : null),
    duplicateApprovedByName: approvedDuplicate.approvedByName || (mayApproveDuplicate ? actor.name : null),
    duplicateApprovedAt: approvedDuplicate.approvedAt || (mayApproveDuplicate ? now : null),
    duplicateApprovalReason: approvedDuplicate.reason || (mayApproveDuplicate ? input.duplicateApprovalReason!.trim() : null),
    customerType: input.customerType || CUSTOMER_TYPES[0],
    country: geo.country,
    countryCode: geo.countryCode,
    countryName: geo.countryName,
    stateCode: geo.stateCode,
    stateName: geo.stateName,
    cityName: geo.cityName,
    city: geo.city,
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
  const normalizedCustomerName = normalizeCustomerName(input.name);
  if (!normalizedCustomerName) throw new Error("请填写有效客户名称。");
  const currentNormalized = existing.normalizedCustomerName || normalizeCustomerName(existing.name);
  const duplicate = checkCustomerDuplicateName(store, input.name, customerId);
  if (normalizedCustomerName !== currentNormalized && duplicate.isDuplicate) {
    const request = createCustomerDuplicateReviewRequest(store, actor, { ...input, ownerUserId }, input.duplicateApprovalReason || "");
    throw new DuplicateCustomerNameError("客户名称已存在，已提交重复客户审核申请。", request.id);
  }
  const identity =
    normalizedCustomerName === currentNormalized && existing.customerIdentityId
      ? store.getCustomerIdentities().find((item) => item.id === existing.customerIdentityId) || ensureCustomerIdentity(store, input.name, normalizedCustomerName)
      : duplicate.identity || ensureCustomerIdentity(store, input.name, normalizedCustomerName);

  const geo = normalizeCustomerGeo({
    countryCode: input.countryCode,
    countryName: input.countryName,
    stateCode: input.stateCode,
    stateName: input.stateName,
    cityName: input.cityName,
    country: input.country ?? existing.country,
    city: input.city ?? existing.city
  });
  const next: ExportCustomer = {
    ...existing,
    ...pickSystemCustomerFields(input),
    country: geo.country,
    countryCode: geo.countryCode,
    countryName: geo.countryName,
    stateCode: geo.stateCode,
    stateName: geo.stateName,
    cityName: geo.cityName,
    city: geo.city,
    name: input.name.trim(),
    customerIdentityId: identity.id,
    normalizedCustomerName,
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

export function checkCustomerDuplicateName(store: KingaStore, proposedName: string, excludeCustomerId?: string) {
  const normalizedName = normalizeCustomerName(proposedName);
  const identity = store.getCustomerIdentities().find((item) => item.scope === "export_customer" && item.normalizedName === normalizedName) || null;
  const existingCustomers = store
    .getCustomers()
    .filter((customer) => customer.id !== excludeCustomerId)
    .filter((customer) => (identity ? customer.customerIdentityId === identity.id : false) || normalizeCustomerName(customer.name) === normalizedName);
  return {
    normalizedName,
    identity,
    existingCustomers,
    isDuplicate: existingCustomers.length > 0
  };
}

function ensureCustomerIdentity(store: KingaStore, displayName: string, normalizedName: string): CustomerIdentity {
  const existing = store.getCustomerIdentities().find((item) => item.scope === "export_customer" && item.normalizedName === normalizedName);
  if (existing) return existing;
  const now = nowIso();
  const identity: CustomerIdentity = {
    id: newId("cid"),
    scope: "export_customer",
    displayName: displayName.trim(),
    normalizedName,
    createdAt: now,
    updatedAt: now
  };
  store.saveCustomerIdentities([...store.getCustomerIdentities(), identity]);
  return identity;
}

export function createCustomerDuplicateReviewRequest(
  store: KingaStore,
  actor: User,
  input: ExportCustomerInput,
  requestReason = ""
): CustomerDuplicateReviewRequest {
  const duplicate = checkCustomerDuplicateName(store, input.name);
  if (!duplicate.isDuplicate) throw new Error("未检测到重复客户，无需提交审核。");
  const now = nowIso();
  const request: CustomerDuplicateReviewRequest = {
    id: newId("cdr"),
    department: "export",
    moduleKey: "export_customer",
    requestedByUserId: actor.id,
    requestedByName: actor.name,
    proposedCustomerName: input.name.trim(),
    normalizedName: duplicate.normalizedName,
    existingIdentityId: duplicate.identity?.id || null,
    existingCustomerIds: duplicate.existingCustomers.map((customer) => customer.id),
    requestedPayload: { ...input },
    requestReason: requestReason.trim() || null,
    status: "pending",
    decidedByUserId: null,
    decidedByName: null,
    decisionNote: null,
    decidedAt: null,
    createdCustomerId: null,
    createdAt: now,
    updatedAt: now
  };
  store.saveCustomerDuplicateReviewRequests([...store.getCustomerDuplicateReviewRequests(), request]);
  return request;
}

export function listCustomerDuplicateReviewRequests(store: KingaStore, actor: User): CustomerDuplicateReviewRequest[] {
  const requests = store.getCustomerDuplicateReviewRequests();
  if (hasPermission(store, actor, "export.customers.duplicate_review.view")) return requests;
  return requests.filter((request) => request.requestedByUserId === actor.id);
}

export function approveCustomerDuplicateReviewRequest(
  store: KingaStore,
  actor: User,
  requestId: string,
  decisionNote: string
): ExportCustomer {
  if (!canManageDuplicateReview(store, actor)) throw new Error("当前账号不能审核重复客户。");
  const requests = store.getCustomerDuplicateReviewRequests();
  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status !== "pending") throw new Error("审核申请不存在或已处理。");
  if (request.requestedByUserId === actor.id) throw new Error("不能审核自己的重复客户申请。");
  const now = nowIso();
  const customer = createExportCustomerInternal(
    store,
    actor,
    request.requestedPayload as ExportCustomerInput,
    { reviewRequestId: request.id, approvedByUserId: actor.id, approvedByName: actor.name, approvedAt: now, reason: decisionNote }
  );
  store.saveCustomerDuplicateReviewRequests(requests.map((item) => item.id === requestId
    ? { ...item, status: "approved", decidedByUserId: actor.id, decidedByName: actor.name, decisionNote, decidedAt: now, createdCustomerId: customer.id, updatedAt: now }
    : item));
  return customer;
}

export function rejectCustomerDuplicateReviewRequest(store: KingaStore, actor: User, requestId: string, decisionNote: string) {
  if (!canManageDuplicateReview(store, actor)) throw new Error("当前账号不能审核重复客户。");
  const requests = store.getCustomerDuplicateReviewRequests();
  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status !== "pending") throw new Error("审核申请不存在或已处理。");
  if (request.requestedByUserId === actor.id) throw new Error("不能审核自己的重复客户申请。");
  const now = nowIso();
  store.saveCustomerDuplicateReviewRequests(requests.map((item) => item.id === requestId
    ? { ...item, status: "rejected", decidedByUserId: actor.id, decidedByName: actor.name, decisionNote, decidedAt: now, updatedAt: now }
    : item));
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
