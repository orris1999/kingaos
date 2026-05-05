import { describe, expect, it } from "vitest";
import { bootstrapDemoUsers, loginUser } from "@/lib/honoa/auth/actions";
import { canEditCustomer, createExportCustomer } from "@/lib/honoa/customers/actions";
import {
  markPrimaryContact,
  normalizeCustomerAttachment,
  normalizeCustomerContacts,
  softDeleteAttachment
} from "@/lib/honoa/shared/customer-relations";
import { booleanFieldValueLabel, fieldTypeLabel } from "@/lib/honoa/shared/field-types";
import { createKingaStore } from "@/lib/honoa/shared/mock-store";
import { createMemoryStorage } from "@/lib/honoa/shared/storage";

function freshStore() {
  const store = createKingaStore(createMemoryStorage());
  bootstrapDemoUsers(store);
  return store;
}

describe("KingaOS customer contacts, attachments, and field type labels", () => {
  it("一个客户可以创建多个联系人", () => {
    const contacts = normalizeCustomerContacts([
      { name: "老板", phone: "13800000000", isPrimary: true },
      { name: "采购", email: "buyer@example.com" }
    ]);

    expect(contacts).toHaveLength(2);
  });

  it("一个客户最多只有一个主要联系人", () => {
    const contacts = normalizeCustomerContacts([
      { name: "老板", isPrimary: true },
      { name: "采购", isPrimary: true }
    ]);

    expect(contacts.filter((contact) => contact.isPrimary)).toHaveLength(1);
  });

  it("设置第二个主要联系人后，第一个自动取消主要联系人", () => {
    const contacts = markPrimaryContact([
      { id: "first", isPrimary: true },
      { id: "second", isPrimary: false }
    ], "second");

    expect(contacts).toEqual([
      { id: "first", isPrimary: false },
      { id: "second", isPrimary: true }
    ]);
  });

  it("业务员不能给别人的客户添加联系人", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const staffA = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const staffB = store.getUsers().find((user) => user.email === "export.b@kingaos.local")!;
    const customer = createExportCustomer(store, superAdmin, { name: "B 客户", ownerUserId: staffB.id });

    expect(canEditCustomer(store, staffA, customer)).toBe(false);
  });

  it("经理可以给出口部客户添加联系人", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const manager = store.getUsers().find((user) => user.email === "export.manager@kingaos.local")!;
    const staffA = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const customer = createExportCustomer(store, superAdmin, { name: "A 客户", ownerUserId: staffA.id });

    expect(canEditCustomer(store, manager, customer)).toBe(true);
  });

  it("可以给客户添加附件链接", () => {
    const attachment = normalizeCustomerAttachment({
      attachmentName: "名片",
      attachmentType: "名片",
      fileUrl: "https://example.com/card.jpg",
      description: "客户发来的名片"
    });

    expect(attachment.fileUrl).toBe("https://example.com/card.jpg");
    expect(attachment.attachmentType).toBe("名片");
  });

  it("业务员不能给别人的客户添加附件", () => {
    const store = freshStore();
    const superAdmin = loginUser(store, "superadmin@kingaos.local", "roserose");
    const staffA = store.getUsers().find((user) => user.email === "export.a@kingaos.local")!;
    const staffB = store.getUsers().find((user) => user.email === "export.b@kingaos.local")!;
    const customer = createExportCustomer(store, superAdmin, { name: "B 客户", ownerUserId: staffB.id });

    expect(canEditCustomer(store, staffA, customer)).toBe(false);
  });

  it("删除附件是软删除", () => {
    const deleted = softDeleteAttachment({ deletedAt: null }, "2026-05-05T00:00:00.000Z");

    expect(deleted.deletedAt).toBe("2026-05-05T00:00:00.000Z");
  });

  it("字段类型 text 在 UI label 中显示为 单行文本", () => {
    expect(fieldTypeLabel("text")).toBe("单行文本");
  });

  it("字段类型 boolean 在 UI label 中显示为 是/否", () => {
    expect(fieldTypeLabel("boolean")).toBe("是/否");
  });

  it("boolean 字段值 true 显示为 是，false 显示为 否", () => {
    expect(booleanFieldValueLabel(true)).toBe("是");
    expect(booleanFieldValueLabel(false)).toBe("否");
  });
});
