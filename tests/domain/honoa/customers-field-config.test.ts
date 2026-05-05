import { describe, expect, it } from "vitest";
import { bootstrapDemoUsers, loginUser } from "@/lib/honoa/auth/actions";
import { createExportCustomer, listExportCustomers } from "@/lib/honoa/customers/actions";
import { createCustomerFieldConfig, listCustomerFieldConfigs } from "@/lib/honoa/field-config/actions";
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
});
