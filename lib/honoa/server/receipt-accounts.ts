import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RECEIPT_ACCOUNT_CURRENCIES, RECEIPT_ACCOUNT_PAYMENT_METHODS } from "../shared/constants";
import type { AuthUser } from "./auth";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser, requireServerPermission } from "./auth";
import { canEditCustomerServer, canViewCustomerServer } from "./customers";
import { prisma } from "./db";

export function canViewReceiptAccountsServer(actor: AuthUser) {
  return hasAnyServerPermission(actor, ["finance.receipt_accounts.view", "finance.receipt_accounts.manage"]);
}

export function canManageReceiptAccountsServer(actor: AuthUser) {
  return hasServerPermission(actor, "finance.receipt_accounts.manage");
}

export function canSelectReceiptAccountForCustomerServer(actor: AuthUser, customer: { ownerUserId: string; department: string }) {
  return hasServerPermission(actor, "export.customers.receipt_account.select") && canEditCustomerServer(actor, customer);
}

export async function listReceiptAccountsForActor(actor: AuthUser, includeInactive = true) {
  if (!canViewReceiptAccountsServer(actor)) throw new Error("当前账号不能查看官方收款账号。");
  return prisma.companyReceiptAccount.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: { _count: { select: { customers: true } } },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
  });
}

export async function getReceiptAccountForActor(actor: AuthUser, accountId: string) {
  if (!canViewReceiptAccountsServer(actor)) throw new Error("当前账号不能查看官方收款账号。");
  const account = await prisma.companyReceiptAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("收款账号不存在。");
  return account;
}

export async function countCustomersUsingReceiptAccount(actor: AuthUser, accountId: string) {
  if (!canViewReceiptAccountsServer(actor)) throw new Error("当前账号不能查看官方收款账号影响范围。");
  return prisma.customer.count({ where: { department: "export", defaultReceiptAccountId: accountId } });
}

export async function listCustomersUsingReceiptAccount(actor: AuthUser, accountId: string) {
  if (!canViewReceiptAccountsServer(actor)) throw new Error("当前账号不能查看官方收款账号影响范围。");
  const customers = await prisma.customer.findMany({
    where: { department: "export", defaultReceiptAccountId: accountId },
    select: {
      id: true,
      customerCode: true,
      name: true,
      companyName: true,
      ownerUserId: true,
      ownerName: true,
      department: true,
      status: true,
      country: true,
      countryCode: true,
      countryName: true,
      stateCode: true,
      stateName: true,
      city: true,
      cityName: true,
      updatedAt: true,
      defaultReceiptAccount: { select: { isActive: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
  return customers.map((customer) => ({
    ...customer,
    canOpenCustomer: canViewCustomerServer(actor, customer)
  }));
}

export async function getReceiptAccountImpactSummary(actor: AuthUser, accountId: string) {
  const [affectedCustomerCount, customers] = await Promise.all([
    countCustomersUsingReceiptAccount(actor, accountId),
    listCustomersUsingReceiptAccount(actor, accountId)
  ]);
  return { affectedCustomerCount, customers };
}

export async function listSelectableReceiptAccounts(currentReceiptAccountId?: string | null) {
  return prisma.companyReceiptAccount.findMany({
    where: currentReceiptAccountId
      ? { OR: [{ isActive: true }, { id: currentReceiptAccountId }] }
      : { isActive: true },
    orderBy: [{ isActive: "desc" }, { currency: "asc" }, { displayName: "asc" }]
  });
}

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function optionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("日期格式无效。");
  return date;
}

function receiptAccountInputFromForm(formData: FormData) {
  const displayName = formString(formData, "displayName");
  const currency = formString(formData, "currency").toUpperCase();
  const companyName = formString(formData, "companyName");
  const accountNo = formString(formData, "accountNo");
  const bankName = formString(formData, "bankName");
  const paymentMethod = formString(formData, "paymentMethod") || "bank_transfer";
  const allowedPaymentMethods = RECEIPT_ACCOUNT_PAYMENT_METHODS.map(([key]) => key);

  if (!displayName) throw new Error("请填写收款方案名称。");
  if (!currency) throw new Error("请选择币种。");
  if (!RECEIPT_ACCOUNT_CURRENCIES.includes(currency)) throw new Error("币种无效。");
  if (!companyName) throw new Error("请填写收款主体。");
  if (!accountNo) throw new Error("请填写账号。");
  if (!bankName) throw new Error("请填写开户行。");
  if (!allowedPaymentMethods.includes(paymentMethod as (typeof allowedPaymentMethods)[number])) throw new Error("支付方式无效。");

  return {
    displayName,
    scenarioName: formString(formData, "scenarioName") || null,
    paymentMethod,
    currency,
    companyName,
    accountNo,
    bankName,
    swiftCode: formString(formData, "swiftCode") || null,
    bankAddress: formString(formData, "bankAddress") || null,
    usageNotes: formString(formData, "usageNotes") || null,
    riskNotes: formString(formData, "riskNotes") || null,
    effectiveFrom: optionalDate(formString(formData, "effectiveFrom")),
    effectiveTo: optionalDate(formString(formData, "effectiveTo")),
    isActive: formData.get("isActive") === "1"
  };
}

async function nextReceiptAccountCode(attempt = 0) {
  const count = await prisma.companyReceiptAccount.count();
  return `KJ-RA-${String(count + attempt + 1).padStart(4, "0")}`;
}

async function createReceiptAccountWithRetry(data: Omit<Prisma.CompanyReceiptAccountUncheckedCreateInput, "id" | "accountCode" | "createdAt" | "updatedAt">) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.companyReceiptAccount.create({
        data: { ...data, accountCode: await nextReceiptAccountCode(attempt) }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("收款账号编号生成冲突，请重试。");
}

export async function createReceiptAccountAction(formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "finance.receipt_accounts.manage");
  const input = receiptAccountInputFromForm(formData);
  const account = await createReceiptAccountWithRetry({
    ...input,
    maintainedByUserId: actor.id,
    maintainedByName: actor.name
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "company_receipt_account.create",
      entityType: "CompanyReceiptAccount",
      entityId: account.id,
      metadata: { receiptAccountId: account.id, accountCode: account.accountCode, displayName: account.displayName }
    }
  });
  revalidatePath("/finance");
  revalidatePath("/finance/receipt-accounts");
  redirect(`/finance/receipt-accounts/${account.id}`);
}

export async function updateReceiptAccountAction(accountId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "finance.receipt_accounts.manage");
  const existing = await prisma.companyReceiptAccount.findUnique({ where: { id: accountId } });
  if (!existing) throw new Error("收款账号不存在。");
  const input = receiptAccountInputFromForm(formData);
  const updated = await prisma.companyReceiptAccount.update({
    where: { id: accountId },
    data: {
      ...input,
      disabledAt: input.isActive ? null : existing.disabledAt || new Date(),
      disabledReason: input.isActive ? null : existing.disabledReason,
      maintainedByUserId: actor.id,
      maintainedByName: actor.name
    }
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "company_receipt_account.update",
      entityType: "CompanyReceiptAccount",
      entityId: accountId,
      metadata: { receiptAccountId: accountId, accountCode: updated.accountCode, displayName: updated.displayName }
    }
  });
  revalidatePath("/finance/receipt-accounts");
  revalidatePath(`/finance/receipt-accounts/${accountId}`);
  redirect(`/finance/receipt-accounts/${accountId}`);
}

export async function disableReceiptAccountAction(accountId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "finance.receipt_accounts.manage");
  const disabledReason = formString(formData, "disabledReason");
  if (!disabledReason) throw new Error("请填写停用原因。");
  const affectedCustomers = await prisma.customer.findMany({
    where: { department: "export", defaultReceiptAccountId: accountId },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 20
  });
  const affectedCustomerCount = await prisma.customer.count({
    where: { department: "export", defaultReceiptAccountId: accountId }
  });
  const updated = await prisma.companyReceiptAccount.update({
    where: { id: accountId },
    data: {
      isActive: false,
      disabledAt: new Date(),
      disabledReason,
      maintainedByUserId: actor.id,
      maintainedByName: actor.name
    }
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "company_receipt_account.disable",
      entityType: "CompanyReceiptAccount",
      entityId: accountId,
      metadata: {
        receiptAccountId: accountId,
        accountCode: updated.accountCode,
        displayName: updated.displayName,
        disabledReason,
        affectedCustomerCount,
        affectedCustomerIds: affectedCustomers.map((customer) => customer.id)
      }
    }
  });
  revalidatePath("/finance/receipt-accounts");
  revalidatePath(`/finance/receipt-accounts/${accountId}`);
  revalidatePath("/export/customers");
  redirect(`/finance/receipt-accounts/${accountId}`);
}

export async function enableReceiptAccountAction(accountId: string) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "finance.receipt_accounts.manage");
  const updated = await prisma.companyReceiptAccount.update({
    where: { id: accountId },
    data: {
      isActive: true,
      disabledAt: null,
      disabledReason: null,
      maintainedByUserId: actor.id,
      maintainedByName: actor.name
    }
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "company_receipt_account.enable",
      entityType: "CompanyReceiptAccount",
      entityId: accountId,
      metadata: { receiptAccountId: accountId, accountCode: updated.accountCode, displayName: updated.displayName }
    }
  });
  revalidatePath("/finance/receipt-accounts");
  revalidatePath(`/finance/receipt-accounts/${accountId}`);
  redirect(`/finance/receipt-accounts/${accountId}`);
}

export async function receiptAccountSelectionForCustomer(actor: AuthUser, customerId: string, nextAccountId: string | null, note: string | null, existingAccountId?: string | null) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canSelectReceiptAccountForCustomerServer(actor, customer)) {
    throw new Error("当前账号不能为该客户选择默认收款方案。");
  }
  if (!nextAccountId) {
    return { accountId: null, note: note || null };
  }
  const account = await prisma.companyReceiptAccount.findUnique({ where: { id: nextAccountId } });
  if (!account) throw new Error("收款账号不存在。");
  if (!account.isActive && nextAccountId !== existingAccountId) throw new Error("已停用的收款账号不能作为新的默认收款方案。");
  return { accountId: account.id, note: note || null };
}

export async function receiptAccountSelectionForNewCustomer(actor: AuthUser, nextAccountId: string | null, note: string | null) {
  if (!nextAccountId) return { accountId: null, note: note || null };
  requireServerPermission(actor, "export.customers.receipt_account.select");
  const account = await prisma.companyReceiptAccount.findUnique({ where: { id: nextAccountId } });
  if (!account) throw new Error("收款账号不存在。");
  if (!account.isActive) throw new Error("已停用的收款账号不能作为新的默认收款方案。");
  return { accountId: account.id, note: note || null };
}
