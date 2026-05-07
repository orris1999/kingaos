import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { receiptAccountPaymentMethodLabel } from "@/lib/honoa/shared/constants";
import { formatReceiptAccountForContract } from "@/lib/honoa/shared/receipt-account-format";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260506113000_add_company_receipt_accounts/migration.sql"), "utf8");
const constants = readFileSync(join(process.cwd(), "lib/honoa/shared/constants.ts"), "utf8");
const seedData = readFileSync(join(process.cwd(), "prisma/seed-data.mjs"), "utf8");
const receiptServer = readFileSync(join(process.cwd(), "lib/honoa/server/receipt-accounts.ts"), "utf8");
const customerServer = readFileSync(join(process.cwd(), "lib/honoa/server/customers.ts"), "utf8");
const customerForm = readFileSync(join(process.cwd(), "components/server-customer-form.tsx"), "utf8");
const customerSelector = readFileSync(join(process.cwd(), "components/customer-receipt-account-selector.tsx"), "utf8");
const receiptDisableForm = readFileSync(join(process.cwd(), "components/receipt-account-disable-form.tsx"), "utf8");
const customerDetail = readFileSync(join(process.cwd(), "app/export/customers/[id]/page.tsx"), "utf8");
const customerList = readFileSync(join(process.cwd(), "app/export/customers/page.tsx"), "utf8");
const receiptAccountListPage = readFileSync(join(process.cwd(), "app/finance/receipt-accounts/page.tsx"), "utf8");
const receiptAccountDetailPage = readFileSync(join(process.cwd(), "app/finance/receipt-accounts/[id]/page.tsx"), "utf8");
const financePage = readFileSync(join(process.cwd(), "app/finance/page.tsx"), "utf8");

describe("KingaOS company receipt accounts", () => {
  it("Prisma schema 新增 CompanyReceiptAccount 并让 Customer 只保存默认收款方案引用", () => {
    expect(schema).toContain("model CompanyReceiptAccount {");
    expect(schema).toContain("accountCode        String    @unique");
    expect(schema).toContain("customers Customer[]");
    expect(schema).toContain("defaultReceiptAccountId               String?");
    expect(schema).toContain("defaultReceiptAccount                 CompanyReceiptAccount?");
    expect(schema).toContain("defaultReceiptAccountSelectedAt");
    expect(schema).toContain("defaultReceiptAccountSelectedByUserId");
    expect(schema).toContain("defaultReceiptAccountSelectedByName");
    expect(schema).toContain("defaultReceiptAccountNote");
    expect(schema).not.toMatch(/defaultReceiptAccountSnapshot|receiptAccountSnapshot/);
  });

  it("migration 只做 additive change，不删除生产数据", () => {
    expect(migration).toContain('CREATE TABLE "CompanyReceiptAccount"');
    expect(migration).toContain('ALTER TABLE "Customer"');
    expect(migration).toContain('ADD COLUMN "defaultReceiptAccountId"');
    expect(migration).toContain('ON DELETE SET NULL');
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("新增权限 key，并且默认 admin 不天然拥有财务收款账号管理权限", () => {
    for (const permission of [
      "finance.receipt_accounts.view",
      "finance.receipt_accounts.manage",
      "export.customers.receipt_account.select"
    ]) {
      expect(constants).toContain(permission);
      expect(seedData).toContain(permission);
    }
    const adminDefaults = constants.match(/export const ADMIN_DEFAULT_PERMISSIONS[\s\S]*?\];/)?.[0] || "";
    expect(adminDefaults).toContain("export.customers.receipt_account.select");
    expect(adminDefaults).not.toContain("finance.receipt_accounts.view");
    expect(adminDefaults).not.toContain("finance.receipt_accounts.manage");
  });

  it("super_admin 通过 ALL_PERMISSION_KEYS 获得新增权限", () => {
    expect(constants).toContain("export const ALL_PERMISSION_KEYS");
    expect(constants).toContain("finance.receipt_accounts.manage");
  });

  it("收款账号管理必须走服务端 finance.receipt_accounts.manage 权限", () => {
    expect(receiptServer).toContain('requireServerPermission(actor, "finance.receipt_accounts.manage")');
    expect(receiptServer).toContain("createReceiptAccountAction");
    expect(receiptServer).toContain("updateReceiptAccountAction");
    expect(receiptServer).toContain("disableReceiptAccountAction");
    expect(receiptServer).toContain("enableReceiptAccountAction");
  });

  it("业务员选择客户默认收款方案必须走服务端客户编辑权限", () => {
    expect(receiptServer).toContain('hasServerPermission(actor, "export.customers.receipt_account.select")');
    expect(receiptServer).toContain("canEditCustomerServer(actor, customer)");
    expect(customerServer).toContain("receiptAccountSelectionForCustomer");
    expect(customerServer).toContain("receiptAccountSelectionForNewCustomer");
  });

  it("已停用收款账号不能作为新的默认收款方案，但保留历史引用展示", () => {
    expect(receiptServer).toContain("已停用的收款账号不能作为新的默认收款方案");
    expect(receiptServer).toContain("nextAccountId !== existingAccountId");
    expect(customerSelector).toContain("该收款账号已停用，请重新选择有效账号");
    expect(customerDetail).toContain("当前默认收款账号已停用，请重新选择有效账号");
    expect(customerDetail).toContain("停用时间");
    expect(customerDetail).toContain("停用原因");
  });

  it("财务账号详情页显示引用客户列表和有限客户摘要", () => {
    expect(receiptServer).toContain("listCustomersUsingReceiptAccount");
    expect(receiptServer).toContain("canViewReceiptAccountsServer(actor)");
    expect(receiptServer).toContain("canOpenCustomer: canViewCustomerServer(actor, customer)");
    expect(receiptAccountDetailPage).toContain("正在使用该账号的客户");
    expect(receiptAccountDetailPage).toContain("有限客户摘要");
    expect(receiptAccountDetailPage).toContain("无客户详情权限");
    expect(receiptAccountDetailPage).not.toContain("internalNotes");
    expect(receiptAccountDetailPage).not.toContain("specialReminder");
  });

  it("财务账号列表显示使用客户数和停用账号引用提醒", () => {
    expect(receiptServer).toContain("include: { _count: { select: { customers: true } } }");
    expect(receiptAccountListPage).toContain("使用客户数");
    expect(receiptAccountListPage).toContain("已停用，仍有");
    expect(receiptAccountListPage).toContain("#using-customers");
  });

  it("停用账号前提示 affectedCustomerCount，并写入 AuditLog metadata", () => {
    expect(receiptDisableForm).toContain("affectedCustomerCount");
    expect(receiptDisableForm).toContain("系统不会自动清空客户档案引用，也不会自动替换为其他账号");
    expect(receiptServer).toContain("affectedCustomerCount");
    expect(receiptServer).toContain("affectedCustomerIds");
    expect(receiptServer).toContain("take: 20");
  });

  it("停用账号不会自动清空或替换 Customer.defaultReceiptAccountId", () => {
    const disableAction = receiptServer.match(/export async function disableReceiptAccountAction[\s\S]*?export async function enableReceiptAccountAction/)?.[0] || "";
    expect(disableAction).not.toContain("customer.update");
    expect(disableAction).not.toContain("updateMany");
  });

  it("客户列表显示默认收款方案状态，并支持收款账号状态服务端筛选", () => {
    expect(customerList).toContain("收款账号状态");
    expect(customerList).toContain("默认收款方案");
    expect(customerList).toContain("receiptAccountStatus");
    expect(customerServer).toContain("ReceiptAccountStatusFilter");
    expect(customerServer).toContain("defaultReceiptAccount: { is: { isActive: false } }");
    expect(customerServer).toContain("defaultReceiptAccountId: null");
    expect(customerServer).toContain("hasServerPermission(actor, \"export.customers.view_all\")");
    expect(customerServer).toContain("ownerUserId: actor.id");
  });

  it("客户新建 / 编辑在合作信息步骤选择默认收款方案，业务员不能手填银行账号", () => {
    expect(customerForm).toContain('group="合作信息"');
    expect(customerForm).toContain("CustomerReceiptAccountSelector");
    expect(customerSelector).toContain("<select name=\"defaultReceiptAccountId\"");
    expect(customerSelector).toContain("账号");
    expect(customerSelector).not.toContain('name="accountNo"');
  });

  it("财务部只开放收款账号管理，价格相关模块仍暂未开放", () => {
    expect(financePage).toContain("收款账号管理");
    expect(financePage).toContain("价格表设置");
    expect(financePage).toContain("上传价格表");
    expect(financePage).toContain("统一改价");
    expect(financePage).toContain("报价核价");
    expect(financePage).toContain("暂未开放");
  });

  it("创建、编辑、停用、启用和客户选择收款方案会写 AuditLog", () => {
    for (const action of [
      "company_receipt_account.create",
      "company_receipt_account.update",
      "company_receipt_account.disable",
      "company_receipt_account.enable"
    ]) {
      expect(receiptServer).toContain(action);
    }
    expect(customerServer).toContain("customer.receipt_account.select");
    expect(customerServer).toContain("customer.receipt_account.change");
    expect(customerServer).toContain("customer.receipt_account.clear");
  });

  it("accountCode 服务端生成且数据库 unique 兜底", () => {
    expect(schema).toContain("accountCode        String    @unique");
    expect(receiptServer).toContain("async function nextReceiptAccountCode");
    expect(receiptServer).toContain("KJ-RA-");
    expect(receiptServer).toContain('error.code === "P2002"');
  });

  it("formatReceiptAccountForContract 只提供未来合同格式 helper，不创建合同模块", () => {
    const formatted = formatReceiptAccountForContract({
      displayName: "美元收款 - 广发银行",
      currency: "USD",
      companyName: "KINGA",
      accountNo: "123456",
      bankName: "CGB",
      swiftCode: "GDBKCN22",
      bankAddress: "Guangzhou"
    });
    expect(formatted).toContain("Bank Detail（USD ACCOUNT）");
    expect(formatted).toContain("COMPANY NAME：KINGA");
    expect(formatted).toContain("USD ACCOUNT NO.：123456");
    expect(formatted).toContain("BANK NAME：CGB");
    expect(formatted).toContain("SWIFT CODE：GDBKCN22");
    expect(receiptAccountPaymentMethodLabel("bank_transfer")).toBe("银行转账");
  });
});
