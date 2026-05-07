import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_STATUSES,
  customerCompanyDisplay,
  customerStatusLabel,
  defaultCustomerFields
} from "@/lib/honoa/shared/constants";
import { buildCustomerFieldChangeHistoryDrafts } from "@/lib/honoa/shared/customer-field-history";
import { normalizeCustomerName } from "@/lib/honoa/shared/customer-name-normalizer";

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("客户档案 UI 文案和表单状态", () => {
  it("客户列表显示公司名称并使用新的搜索提示", () => {
    const source = readRepoFile("app/export/customers/page.tsx");

    expect(source).toContain("<th>公司名称</th>");
    expect(source).not.toContain("<th>客户名称</th>");
    expect(source).toContain("搜索公司名称 / 客户编号 / 国家 / 负责人");
  });

  it("客户列表使用横向滚动和固定最小宽度，避免表头逐字换行", () => {
    const page = readRepoFile("app/export/customers/page.tsx");
    const css = readRepoFile("app/globals.css");

    expect(page).toContain('data-testid="customer-table-scroll"');
    expect(page).toContain('className="customer-table"');
    expect(page).toContain("<th>客户类型</th>");
    expect(page).toContain("<th>国家 / 地区</th>");
    expect(page).toContain("<th>默认收款方案</th>");
    expect(css).toContain(".customer-table-scroll");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain(".customer-table");
    expect(css).toContain("min-width: 1180px");
    expect(css).toContain("white-space: nowrap");
  });

  it("客户列表把客户类型显示为标签并限制展示数量", () => {
    const source = readRepoFile("app/export/customers/page.tsx");

    expect(source).toContain("function CustomerTypeTags");
    expect(source).toContain("values.slice(0, 3)");
    expect(source).toContain("tag-list-nowrap");
    expect(source).toContain("+{values.length - 3}");
  });

  it("客户列表紧凑显示默认收款方案状态", () => {
    const page = readRepoFile("app/export/customers/page.tsx");
    const css = readRepoFile("app/globals.css");

    expect(page).toContain("receipt-account-compact");
    expect(page).toContain("已停用");
    expect(css).toContain(".receipt-account-compact");
    expect(css).toContain("max-width: 220px");
  });

  it("基础信息主字段显示公司名称，内部仍使用 name 字段", () => {
    const fields = defaultCustomerFields("2026-05-07T00:00:00.000Z");
    const nameField = fields.find((field) => field.fieldKey === "name");

    expect(nameField?.fieldLabel).toBe("公司名称");
    expect(nameField?.fieldKey).toBe("name");
  });

  it("公司信息里不再渲染重复的 companyName 输入", () => {
    const source = readRepoFile("components/server-customer-form.tsx");

    expect(source).toContain("!CUSTOMER_COMPANY_DUPLICATE_FIELD_KEYS.has(field.fieldKey)");
  });

  it("新建和编辑页使用居中表单、步骤卡片和两列基础布局", () => {
    const form = readRepoFile("components/server-customer-form.tsx");
    const css = readRepoFile("app/globals.css");

    expect(form).toContain("customer-form-shell");
    expect(form).toContain("customer-step-panel");
    expect(form).toContain("customer-step-grid");
    expect(css).toContain(".customer-form-shell");
    expect(css).toContain("max-width: 1200px");
    expect(css).toContain(".customer-step-grid");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
  });

  it("客户类型多选使用紧凑控件，不再把全部选项直接铺开", () => {
    const form = readRepoFile("components/server-customer-form.tsx");
    const component = readRepoFile("components/customer-multiselect-field.tsx");
    const css = readRepoFile("app/globals.css");

    expect(form).toContain("CustomerMultiselectField");
    expect(form).toContain('testId="customer-type-multiselect"');
    expect(form).toContain('placeholder="请选择客户类型"');
    expect(component).toContain("<details");
    expect(component).toContain('placeholder = "请选择"');
    expect(component).toContain("selectedOptions.slice(0, 3)");
    expect(css).toContain(".multi-select-menu");
    expect(css).toContain("max-height: 260px");
    expect(css).toContain("overflow-y: auto");
  });

  it("已归档在 UI 上显示为资料已完善", () => {
    expect(customerStatusLabel("已归档")).toBe("资料已完善");
    expect(CUSTOMER_STATUSES).toContain("资料已完善");
  });

  it("修改历史中的旧已归档状态也显示为资料已完善", () => {
    const drafts = buildCustomerFieldChangeHistoryDrafts({
      oldCustomer: { status: "已归档" },
      newCustomer: { status: "暂停合作" },
      oldCustomFields: {},
      newCustomFields: {},
      fieldConfigs: [{ fieldKey: "status", fieldLabel: "客户状态", fieldGroup: "基础信息", fieldType: "select", isActive: true }]
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].oldDisplayValue).toBe("资料已完善");
    expect(drafts[0].newDisplayValue).toBe("暂停合作");
  });

  it("必填字段有必填标识和更明显的输入样式", () => {
    const form = readRepoFile("components/server-customer-form.tsx");
    const css = readRepoFile("app/globals.css");

    expect(form).toContain("required-mark");
    expect(form).toContain("required-badge");
    expect(form).toContain('data-testid="required-field"');
    expect(css).toContain(".required-control");
    expect(css).toContain("background: #fffdf2");
  });

  it("只读字段有只读或系统生成标识", () => {
    const form = readRepoFile("components/server-customer-form.tsx");
    const css = readRepoFile("app/globals.css");

    expect(form).toContain("readonly-badge");
    expect(form).toContain("系统生成");
    expect(form).toContain('data-testid="readonly-field"');
    expect(css).toContain("cursor: not-allowed");
    expect(css).toContain("background: #eef1f4");
  });

  it("默认收款方案详情标明财务维护且业务只读", () => {
    const selector = readRepoFile("components/customer-receipt-account-selector.tsx");

    expect(selector).toContain("财务维护，业务只读");
    expect(selector).toContain("查看官方账号详情");
    expect(selector).toContain("receipt-account-panel");
  });

  it("新建客户页提示附件保存后上传", () => {
    const form = readRepoFile("components/server-customer-form.tsx");

    expect(form).toContain("附件请在客户保存后上传");
    expect(form).toContain("保存客户后，可在客户详情 / 编辑页面添加名片、营业执照、聊天记录、报价资料等附件");
  });

  it("修改历史 tab 仍然存在", () => {
    const detail = readRepoFile("app/export/customers/[id]/page.tsx");

    expect(detail).toContain("修改历史");
  });

  it("客户名称防重复仍基于内部公司名称字段 Customer.name", () => {
    expect(normalizeCustomerName("ABC Trading")).toBe(normalizeCustomerName("ＡＢＣ Trading."));
    expect(customerCompanyDisplay({ name: "坤江公司", companyName: "旧公司名" })).toBe("坤江公司");
    expect(customerCompanyDisplay({ name: "", companyName: "旧公司名" })).toBe("旧公司名");
  });
});
