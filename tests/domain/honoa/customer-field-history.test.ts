import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCustomerFieldChangeHistoryDrafts,
  displayHistoryValue,
  receiptAccountHistoryDisplay
} from "@/lib/honoa/shared/customer-field-history";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260506172000_add_customer_field_change_history/migration.sql"), "utf8");
const customerServer = readFileSync(join(process.cwd(), "lib/honoa/server/customers.ts"), "utf8");
const customerDetail = readFileSync(join(process.cwd(), "app/export/customers/[id]/page.tsx"), "utf8");
const customerForm = readFileSync(join(process.cwd(), "components/server-customer-form.tsx"), "utf8");

const fieldConfigs = [
  { fieldKey: "status", fieldLabel: "客户状态", fieldGroup: "基础信息", fieldType: "select", options: ["跟进中", "已成交"] },
  { fieldKey: "mainProducts", fieldLabel: "主营产品", fieldGroup: "公司信息", fieldType: "textarea" },
  { fieldKey: "purchaseNeed", fieldLabel: "主要产品需求", fieldGroup: "合作信息", fieldType: "textarea" },
  { fieldKey: "specialReminder", fieldLabel: "特殊提醒", fieldGroup: "备注 / 特殊提醒", fieldType: "textarea" },
  { fieldKey: "custom_forwarder", fieldLabel: "指定货代 / 船司", fieldGroup: "合作信息", fieldType: "text" },
  { fieldKey: "custom_confirmed", fieldLabel: "是否确认", fieldGroup: "合作信息", fieldType: "boolean" }
];

describe("KingaOS customer field change history", () => {
  it("新增 CustomerFieldChangeHistory 模型和 additive migration", () => {
    expect(schema).toContain("model CustomerFieldChangeHistory {");
    expect(schema).toContain("fieldChangeHistories CustomerFieldChangeHistory[]");
    expect(migration).toContain('CREATE TABLE "CustomerFieldChangeHistory"');
    expect(migration).toContain('ADD CONSTRAINT "CustomerFieldChangeHistory_customerId_fkey"');
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("修改客户状态会写 CustomerFieldChangeHistory", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { status: "跟进中" },
      newCustomer: { status: "已成交" },
      oldCustomFields: {},
      newCustomFields: {},
      fieldConfigs
    });
    expect(drafts).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldKey: "status", fieldLabel: "客户状态", oldDisplayValue: "跟进中", newDisplayValue: "已成交", changeType: "update" })
    ]));
  });

  it("修改主要产品需求和特殊提醒会写历史", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { mainProducts: "旧主营", purchaseNeed: "123", specialReminder: "" },
      newCustomer: { mainProducts: "新主营", purchaseNeed: "456", specialReminder: "涉敏国家，注意收款账号" },
      oldCustomFields: {},
      newCustomFields: {},
      fieldConfigs
    });
    expect(drafts).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldKey: "mainProducts", oldDisplayValue: "旧主营", newDisplayValue: "新主营" }),
      expect.objectContaining({ fieldKey: "purchaseNeed", oldDisplayValue: "123", newDisplayValue: "456" }),
      expect.objectContaining({ fieldKey: "specialReminder", oldDisplayValue: "未填写", newDisplayValue: "涉敏国家，注意收款账号", changeType: "set" })
    ]));
  });

  it("修改 customFields 中的自定义字段会写历史", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: {},
      newCustomer: {},
      oldCustomFields: { custom_forwarder: "123" },
      newCustomFields: { custom_forwarder: "456" },
      fieldConfigs
    });
    expect(drafts).toEqual([expect.objectContaining({
      fieldKey: "custom_forwarder",
      fieldLabel: "指定货代 / 船司",
      fieldKind: "custom",
      oldDisplayValue: "123",
      newDisplayValue: "456"
    })]);
  });

  it("未变化字段不会写历史", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { status: "跟进中", purchaseNeed: "abc" },
      newCustomer: { status: "跟进中", purchaseNeed: "abc" },
      oldCustomFields: { custom_forwarder: "123" },
      newCustomFields: { custom_forwarder: "123" },
      fieldConfigs
    });
    expect(drafts).toHaveLength(0);
  });

  it("清空字段时 changeType = clear", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { specialReminder: "提醒" },
      newCustomer: { specialReminder: "" },
      oldCustomFields: {},
      newCustomFields: {},
      fieldConfigs
    });
    expect(drafts).toEqual([expect.objectContaining({ fieldKey: "specialReminder", changeType: "clear", newDisplayValue: "未填写" })]);
  });

  it("boolean 字段历史显示 是 / 否", () => {
    expect(displayHistoryValue(true, "boolean")).toBe("是");
    expect(displayHistoryValue(false, "boolean")).toBe("否");
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: {},
      newCustomer: {},
      oldCustomFields: { custom_confirmed: "false" },
      newCustomFields: { custom_confirmed: "true" },
      fieldConfigs
    });
    expect(drafts[0]).toMatchObject({ oldDisplayValue: "否", newDisplayValue: "是" });
  });

  it("默认收款方案从无到有、更换、清空都会写历史，且不保存完整账号", () => {
    const accountA = { id: "ra_1", displayName: "美元收款 - 广发银行", accountCode: "KJ-RA-0001" };
    const accountB = { id: "ra_2", displayName: "美元收款 - 中国银行", accountCode: "KJ-RA-0002" };
    expect(receiptAccountHistoryDisplay(accountA)).toBe("美元收款 - 广发银行 / KJ-RA-0001");
    const setDraft = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { defaultReceiptAccountId: null },
      newCustomer: { defaultReceiptAccountId: "ra_1" },
      oldCustomFields: {},
      newCustomFields: {},
      fieldConfigs,
      newReceiptAccount: accountA
    })[0];
    expect(setDraft).toMatchObject({ fieldKey: "defaultReceiptAccountId", changeType: "set", oldDisplayValue: "未设置", newDisplayValue: "美元收款 - 广发银行 / KJ-RA-0001" });
    expect(JSON.stringify(setDraft)).not.toContain("ACCOUNT NO");

    const changeDraft = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { defaultReceiptAccountId: "ra_1" },
      newCustomer: { defaultReceiptAccountId: "ra_2" },
      oldCustomFields: {},
      newCustomFields: {},
      fieldConfigs,
      oldReceiptAccount: accountA,
      newReceiptAccount: accountB
    })[0];
    expect(changeDraft).toMatchObject({ changeType: "update", oldDisplayValue: "美元收款 - 广发银行 / KJ-RA-0001", newDisplayValue: "美元收款 - 中国银行 / KJ-RA-0002" });

    const clearDraft = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { defaultReceiptAccountId: "ra_1" },
      newCustomer: { defaultReceiptAccountId: null },
      oldCustomFields: {},
      newCustomFields: {},
      fieldConfigs,
      oldReceiptAccount: accountA
    })[0];
    expect(clearDraft).toMatchObject({ changeType: "clear", oldDisplayValue: "美元收款 - 广发银行 / KJ-RA-0001", newDisplayValue: "未设置" });
  });

  it("历史记录在服务端同一个 transaction 中生成，不能由前端伪造 oldValue", () => {
    expect(customerServer).toContain("buildCustomerFieldChangeHistoryDrafts");
    expect(customerServer).toContain("await prisma.$transaction");
    expect(customerServer).toContain("tx.customerFieldChangeHistory.create");
    expect(customerServer).toContain("oldCustomer: existing");
    expect(customerServer).not.toContain('formData.get("oldValue")');
    expect(customerServer).not.toContain('formData.get("oldDisplayValue")');
  });

  it("历史查看权限跟随客户 canViewCustomerServer", () => {
    expect(customerServer).toContain("listCustomerFieldChangeHistoryForActor");
    expect(customerServer).toContain("canViewCustomerServer(actor, customer)");
  });

  it("客户详情页和编辑页提供修改历史入口", () => {
    expect(customerDetail).toContain("修改历史");
    expect(customerDetail).toContain("ChangeHistoryList");
    expect(customerForm).toContain("查看修改历史");
    expect(customerForm).toContain("tab=history");
  });
});
