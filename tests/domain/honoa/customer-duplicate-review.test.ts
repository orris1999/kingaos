import { describe, expect, it } from "vitest";
import { bootstrapDemoUsers, loginUser } from "@/lib/honoa/auth/actions";
import {
  approveCustomerDuplicateReviewRequest,
  createExportCustomer,
  listCustomerDuplicateReviewRequests,
  rejectCustomerDuplicateReviewRequest,
  updateExportCustomer
} from "@/lib/honoa/customers/actions";
import { normalizeCustomerName } from "@/lib/honoa/shared/customer-name-normalizer";
import { DuplicateCustomerNameError } from "@/lib/honoa/shared/errors";
import { createKingaStore } from "@/lib/honoa/shared/mock-store";
import { createMemoryStorage } from "@/lib/honoa/shared/storage";

function freshStore() {
  const store = createKingaStore(createMemoryStorage());
  bootstrapDemoUsers(store);
  return store;
}

describe("KingaOS customer duplicate review domain actions", () => {
  it("normalizeCustomerName 可以处理标点、空格、大小写和全角半角", () => {
    expect(normalizeCustomerName("ABC Trading")).toBe(normalizeCustomerName("ABC Trading."));
    expect(normalizeCustomerName("ABC  Trading")).toBe(normalizeCustomerName("abc trading"));
    expect(normalizeCustomerName("ＡＢＣ Trading")).toBe(normalizeCustomerName("ABC-Trading"));
    expect(normalizeCustomerName("ABC_Trading")).toBe(normalizeCustomerName("ABC Trading"));
  });

  it("第一个客户可以创建，第二个同名客户会进入审核申请", () => {
    const store = freshStore();
    const staffA = loginUser(store, "export.a@kingaos.local", "Kingaos@123456");
    const first = createExportCustomer(store, staffA, { name: "ABC Trading" });

    expect(first.normalizedCustomerName).toBe("abctrading");
    expect(() => createExportCustomer(store, staffA, { name: "ABC Trading." })).toThrow(DuplicateCustomerNameError);
    const requests = listCustomerDuplicateReviewRequests(store, staffA);
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("pending");
    expect(requests[0].normalizedName).toBe("abctrading");
    expect(store.getCustomers()).toHaveLength(1);
  });

  it("业务员不能审核重复客户申请，经理可以审核通过后创建重复客户", () => {
    const store = freshStore();
    const staffA = loginUser(store, "export.a@kingaos.local", "Kingaos@123456");
    const manager = loginUser(store, "export.manager@kingaos.local", "Kingaos@123456");
    createExportCustomer(store, staffA, { name: "ABC Trading" });
    expect(() => createExportCustomer(store, staffA, { name: "abc trading" })).toThrow(DuplicateCustomerNameError);
    const request = listCustomerDuplicateReviewRequests(store, staffA)[0];

    expect(() => approveCustomerDuplicateReviewRequest(store, staffA, request.id, "确属不同主体")).toThrow("不能审核");

    const duplicate = approveCustomerDuplicateReviewRequest(store, manager, request.id, "确属不同主体");

    expect(duplicate.duplicateApprovalStatus).toBe("approved_duplicate");
    expect(duplicate.duplicateApprovalRequestId).toBe(request.id);
    expect(store.getCustomers()).toHaveLength(2);
    expect(listCustomerDuplicateReviewRequests(store, manager).find((item) => item.id === request.id)?.status).toBe("approved");
  });

  it("审核拒绝后不创建重复客户", () => {
    const store = freshStore();
    const staffA = loginUser(store, "export.a@kingaos.local", "Kingaos@123456");
    const manager = loginUser(store, "export.manager@kingaos.local", "Kingaos@123456");
    createExportCustomer(store, staffA, { name: "ABC Trading" });
    expect(() => createExportCustomer(store, staffA, { name: "ABC Trading." })).toThrow(DuplicateCustomerNameError);
    const request = listCustomerDuplicateReviewRequests(store, staffA)[0];

    rejectCustomerDuplicateReviewRequest(store, manager, request.id, "已有客户由原负责人继续跟进");

    expect(store.getCustomers()).toHaveLength(1);
    expect(listCustomerDuplicateReviewRequests(store, manager).find((item) => item.id === request.id)?.status).toBe("rejected");
  });

  it("编辑客户名称改成已有客户名时会被拦截并提交审核", () => {
    const store = freshStore();
    const staffA = loginUser(store, "export.a@kingaos.local", "Kingaos@123456");
    const first = createExportCustomer(store, staffA, { name: "ABC Trading" });
    const second = createExportCustomer(store, staffA, { name: "Different Buyer" });

    expect(() => updateExportCustomer(store, staffA, second.id, { name: "ABC Trading." })).toThrow(DuplicateCustomerNameError);
    expect(store.getCustomers().find((customer) => customer.id === second.id)?.name).toBe("Different Buyer");
    expect(listCustomerDuplicateReviewRequests(store, staffA)).toHaveLength(1);
    expect(store.getCustomers().find((customer) => customer.id === first.id)?.name).toBe("ABC Trading");
  });

  it("两个连续同名创建不会生成两个普通客户", () => {
    const store = freshStore();
    const staffA = loginUser(store, "export.a@kingaos.local", "Kingaos@123456");
    createExportCustomer(store, staffA, { name: "ABC Trading" });
    expect(() => createExportCustomer(store, staffA, { name: "ＡＢＣ Trading" })).toThrow(DuplicateCustomerNameError);

    expect(store.getCustomers()).toHaveLength(1);
    expect(store.getCustomerDuplicateReviewRequests()).toHaveLength(1);
  });
});
