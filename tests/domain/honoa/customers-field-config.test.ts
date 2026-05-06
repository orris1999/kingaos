import { describe, expect, it } from "vitest";
import { bootstrapDemoUsers, loginUser } from "@/lib/honoa/auth/actions";
import { createExportCustomer, listExportCustomers } from "@/lib/honoa/customers/actions";
import { createCustomerFieldConfig, listCustomerFieldConfigs, updateCustomerFieldConfig } from "@/lib/honoa/field-config/actions";
import { assignUserPermissions } from "@/lib/honoa/permissions/actions";
import { createKingaStore } from "@/lib/honoa/shared/mock-store";
import { createMemoryStorage } from "@/lib/honoa/shared/storage";

function freshStore() {
  const store = createKingaStore(createMemoryStorage());
  bootstrapDemoUsers(store);
  return store;
}

describe("KingaOS export customer and field-config domain actions", () => {
  it("业务员只能看到自己客户", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const staffA = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const staffB = store.getUsers().find((user) => user.email === "export.b@kingaos.local")!;
    createExportCustomer(store, superAdmin, { name: "A 客户", ownerUserId: staffA.id });
    createExportCustomer(store, superAdmin, { name: "B 客户", ownerUserId: staffB.id });

    expect(listExportCustomers(store, staffA).map((customer) => customer.name)).toEqual(["A 客户"]);
    expect(listExportCustomers(store, staffB).map((customer) => customer.name)).toEqual(["B 客户"]);
  });

  it("经理可以看到出口部所有客户", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const manager = store.getUsers().find((user) => user.email === "export.manager@kingaos.local")!;
    const staffA = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const staffB = store.getUsers().find((user) => user.email === "export.b@kingaos.local")!;
    createExportCustomer(store, superAdmin, { name: "A 客户", ownerUserId: staffA.id });
    createExportCustomer(store, superAdmin, { name: "B 客户", ownerUserId: staffB.id });

    expect(listExportCustomers(store, manager)).toHaveLength(2);
  });

  it("未授权 admin 不能进入字段配置", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const admin = store.getUsers().find((user) => user.email === "admin@kingaos.local")!;
    assignUserPermissions(store, superAdmin, admin.id, ["admin.dashboard.view"]);

    expect(() => listCustomerFieldConfigs(store, admin, true)).toThrow("不能配置");
  });

  it("有权限 admin 可以进入字段配置", () => {
    const store = freshStore();
    const admin = loginUser(store, "admin@kingaos.local", "Kingaos@123456");
    const fields = listCustomerFieldConfigs(store, admin, true);
    expect(fields.some((field) => field.fieldLabel === "客户名称")).toBe(true);
  });

  it("客户编号不重复", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const staffA = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const first = createExportCustomer(store, superAdmin, { name: "A 客户", ownerUserId: staffA.id });
    const second = createExportCustomer(store, superAdmin, { name: "B 客户", ownerUserId: staffA.id });
    expect(first.customerCode).not.toBe(second.customerCode);
    expect(first.customerCode).toMatch(/^KJ-EXP-\d{8}-0001$/);
    expect(second.customerCode).toMatch(/^KJ-EXP-\d{8}-0002$/);
  });

  it("字段配置新增后，新建客户表单可读取到字段定义", () => {
    const store = freshStore();
    const admin = loginUser(store, "admin@kingaos.local", "Kingaos@123456");
    createCustomerFieldConfig(store, admin, {
      fieldLabel: "信用等级",
      fieldGroup: "合作信息",
      fieldType: "select",
      required: false,
      options: ["A", "B"],
      sortOrder: 225,
      isActive: true
    });
    const activeFields = listCustomerFieldConfigs(store);
    expect(activeFields.some((field) => field.fieldLabel === "信用等级" && field.fieldGroup === "合作信息")).toBe(true);
  });

  it("自定义字段可以从 text 改成 number", () => {
    const store = freshStore();
    const admin = loginUser(store, "admin@kingaos.local", "Kingaos@123456");
    const field = createCustomerFieldConfig(store, admin, {
      fieldLabel: "年度采购量",
      fieldGroup: "合作信息",
      fieldType: "text",
      required: false,
      options: [],
      sortOrder: 260,
      isActive: true
    });

    const updated = updateCustomerFieldConfig(store, admin, field.id, { ...field, fieldType: "number" });

    expect(updated.fieldType).toBe("number");
  });

  it("自定义字段可以从 text 改成 boolean", () => {
    const store = freshStore();
    const admin = loginUser(store, "admin@kingaos.local", "Kingaos@123456");
    const field = createCustomerFieldConfig(store, admin, {
      fieldLabel: "是否重点客户",
      fieldGroup: "合作信息",
      fieldType: "text",
      required: false,
      options: [],
      sortOrder: 261,
      isActive: true
    });

    const updated = updateCustomerFieldConfig(store, admin, field.id, { ...field, fieldType: "boolean" });

    expect(updated.fieldType).toBe("boolean");
  });

  it("客户来源按自定义字段配置管理并可修改类型", () => {
    const store = freshStore();
    const admin = loginUser(store, "admin@kingaos.local", "Kingaos@123456");
    const sourceField = listCustomerFieldConfigs(store, admin, true).find((field) => field.fieldKey === "source")!;

    expect(sourceField.fieldLabel).toBe("客户来源");
    expect(sourceField.isSystemField).toBe(false);

    const updated = updateCustomerFieldConfig(store, admin, sourceField.id, {
      ...sourceField,
      fieldType: "select",
      options: ["展会", "老客户介绍", "网络询盘"]
    });

    expect(updated.fieldType).toBe("select");
    expect(updated.options).toEqual(["展会", "老客户介绍", "网络询盘"]);
  });

  it("系统字段默认不能修改 fieldType", () => {
    const store = freshStore();
    const admin = loginUser(store, "admin@kingaos.local", "Kingaos@123456");
    const systemField = listCustomerFieldConfigs(store, admin, true).find((field) => field.fieldKey === "name")!;

    const updated = updateCustomerFieldConfig(store, admin, systemField.id, { ...systemField, fieldType: "number" });

    expect(updated.fieldType).toBe("text");
  });

  it("无权限用户不能修改字段类型", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const admin = store.getUsers().find((user) => user.email === "admin@kingaos.local")!;
    assignUserPermissions(store, superAdmin, admin.id, ["admin.dashboard.view"]);
    const systemField = listCustomerFieldConfigs(store).find((field) => field.fieldKey === "name")!;

    expect(() => updateCustomerFieldConfig(store, admin, systemField.id, { ...systemField, fieldType: "number" })).toThrow("不能配置");
  });

  it("修改字段类型不会清空 Customer.customFields", () => {
    const store = freshStore();
    const admin = loginUser(store, "admin@kingaos.local", "Kingaos@123456");
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const staffA = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const field = createCustomerFieldConfig(store, admin, {
      fieldLabel: "历史字段",
      fieldGroup: "合作信息",
      fieldType: "text",
      required: false,
      options: [],
      sortOrder: 262,
      isActive: true
    });
    const customer = createExportCustomer(store, superAdmin, {
      name: "有历史值客户",
      ownerUserId: staffA.id,
      customFields: { [field.fieldKey]: "ABC" }
    });

    updateCustomerFieldConfig(store, admin, field.id, { ...field, fieldType: "number" });

    expect(store.getCustomers().find((item) => item.id === customer.id)?.customFields[field.fieldKey]).toBe("ABC");
  });
});
