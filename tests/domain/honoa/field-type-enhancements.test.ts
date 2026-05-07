import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCustomerFieldConfig } from "@/lib/honoa/field-config/actions";
import { bootstrapDemoUsers, loginUser } from "@/lib/honoa/auth/actions";
import { createExportCustomer } from "@/lib/honoa/customers/actions";
import { customerTypeDisplay } from "@/lib/honoa/shared/constants";
import { buildCustomerFieldChangeHistoryDrafts, hasMeaningfulFieldChange } from "@/lib/honoa/shared/customer-field-history";
import { fieldTypeLabel } from "@/lib/honoa/shared/field-types";
import { displayFieldValue, isFieldValueCompatible } from "@/lib/honoa/shared/field-values";
import { normalizeFieldOptions } from "@/lib/honoa/shared/field-options";
import { createKingaStore } from "@/lib/honoa/shared/mock-store";
import { createMemoryStorage } from "@/lib/honoa/shared/storage";

function freshStore() {
  const store = createKingaStore(createMemoryStorage());
  bootstrapDemoUsers(store);
  return store;
}

describe("字段配置增强 MVP", () => {
  it("字段类型映射包含 多选 / 超链接 / 附件", () => {
    expect(fieldTypeLabel("multiselect")).toBe("多选");
    expect(fieldTypeLabel("url")).toBe("超链接");
    expect(fieldTypeLabel("attachment")).toBe("附件");
  });

  it("管理员可以创建 multiselect 字段并配置内部说明", () => {
    const store = freshStore();
    const admin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const field = createCustomerFieldConfig(store, admin, {
      fieldLabel: "客户属性",
      fieldType: "multiselect",
      fieldGroup: "合作信息",
      required: false,
      options: [{ value: "A", label: "A 类", internalNote: "经理重点跟进", isActive: true, sortOrder: 1 }],
      sortOrder: 300,
      isActive: true
    });

    expect(field.fieldType).toBe("multiselect");
    expect(normalizeFieldOptions(field.options)[0].internalNote).toBe("经理重点跟进");
  });

  it("业务员填写 multiselect 字段后 customFields 保存数组，详情显示多个标签文本", () => {
    const store = freshStore();
    const admin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const owner = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const customer = createExportCustomer(store, admin, {
      name: "多选客户",
      ownerUserId: owner.id,
      customFields: { custom_attrs: ["工厂", "品牌商"] }
    });

    expect(customer.customFields.custom_attrs).toEqual(["工厂", "品牌商"]);
    expect(displayFieldValue(customer.customFields.custom_attrs, "multiselect")).toBe("工厂、品牌商");
  });

  it("select 仍然保持单选，不被 multiselect 破坏", () => {
    const options = [{ value: "A", label: "A 类" }, { value: "B", label: "B 类" }];

    expect(displayFieldValue("A", "select", options)).toBe("A 类");
    expect(isFieldValueCompatible("A", "select", options)).toBe(true);
  });

  it("客户类型支持多选，老 customerType 单值可以 fallback 显示", () => {
    expect(customerTypeDisplay({ customerType: "贸易商", customerTypes: ["工厂", "品牌商"] })).toBe("工厂、品牌商");
    expect(customerTypeDisplay({ customerType: "贸易商" })).toBe("贸易商");
  });

  it("url 字段保存并显示为可点击链接文本，javascript 链接被拒绝", () => {
    const value = { label: "到访汇总", url: "https://example.com/visit" };

    expect(displayFieldValue(value, "url")).toBe("到访汇总 / https://example.com/visit");
    expect(isFieldValueCompatible(value, "url")).toBe(true);
    expect(isFieldValueCompatible({ url: "http://example.com" }, "url")).toBe(true);
    expect(isFieldValueCompatible({ url: "/export/customers" }, "url")).toBe(true);
    expect(isFieldValueCompatible({ url: "javascript:alert(1)" }, "url")).toBe(false);
    expect(isFieldValueCompatible({ url: "data:text/html;base64,abc" }, "url")).toBe(false);
    expect(isFieldValueCompatible({ url: "vbscript:msgbox(1)" }, "url")).toBe(false);
    expect(isFieldValueCompatible({ url: "file:///etc/passwd" }, "url")).toBe(false);
  });

  it("attachment 字段保存 attachmentId 引用，不存文件二进制、base64 或 uploadUrl", () => {
    const value = ["att_001"];
    const attachmentField = readFileSync(join(process.cwd(), "components/customer-attachment-field.tsx"), "utf8");
    const serverCustomers = readFileSync(join(process.cwd(), "lib/honoa/server/customers.ts"), "utf8");

    expect(displayFieldValue(value, "attachment")).toBe("1 个附件");
    expect(JSON.stringify(value)).not.toContain("uploadUrl");
    expect(JSON.stringify(value)).not.toContain("base64");
    expect(attachmentField).toContain('name={`${field.fieldKey}__attachmentId`}');
    expect(serverCustomers).toContain("const currentIds = Array.isArray(customFields[fieldKey])");
    expect(serverCustomers).toContain("const nextIds = Array.from(new Set([...currentIds, attachment.id]))");
  });

  it("内部说明只用于编辑页数据结构，详情显示只返回 label", () => {
    const options = [{ value: "A", label: "A 类", internalNote: "内部重点说明", isActive: true }];

    expect(normalizeFieldOptions(options)[0].internalNote).toBe("内部重点说明");
    expect(displayFieldValue("A", "select", options)).toBe("A 类");
    expect(displayFieldValue("A", "select", options)).not.toContain("内部重点说明");
  });

  it("修改历史记录 multiselect 变化且继续避免 未填写 到 未填写", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: {},
      newCustomer: {},
      oldCustomFields: { custom_attrs: ["A", "B"], custom_empty: "" },
      newCustomFields: { custom_attrs: ["A", "C"], custom_empty: "   " },
      fieldConfigs: [
        { fieldKey: "custom_attrs", fieldLabel: "客户属性", fieldGroup: "合作信息", fieldType: "multiselect", options: ["A", "B", "C"] },
        { fieldKey: "custom_empty", fieldLabel: "空字段", fieldGroup: "合作信息", fieldType: "text" }
      ]
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].fieldKey).toBe("custom_attrs");
    expect(drafts[0].oldDisplayValue).toBe("A、B");
    expect(drafts[0].newDisplayValue).toBe("A、C");
    expect(hasMeaningfulFieldChange("", "   ", "text")).toBe(false);
  });

  it("修改历史兼容 url / attachment，且不记录 OSS 临时 uploadUrl", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: {},
      newCustomer: {},
      oldCustomFields: { custom_visit: null, custom_files: [] },
      newCustomFields: { custom_visit: { label: "到访汇总", url: "/export/customers/abc" }, custom_files: ["att_001"] },
      fieldConfigs: [
        { fieldKey: "custom_visit", fieldLabel: "到访汇总", fieldGroup: "合作信息", fieldType: "url" },
        { fieldKey: "custom_files", fieldLabel: "名片附件", fieldGroup: "联系人信息", fieldType: "attachment" }
      ]
    });

    expect(drafts.map((draft) => draft.fieldKey)).toEqual(["custom_files", "custom_visit"]);
    expect(JSON.stringify(drafts)).not.toContain("uploadUrl");
    expect(drafts.find((draft) => draft.fieldKey === "custom_files")?.newDisplayValue).toBe("1 个附件");
  });
});
