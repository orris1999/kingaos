import type { CustomerFieldConfig, CustomerFieldGroup, CustomerFieldType, PermissionKey } from "./domain-types";

export const APP_NAME = "KingaOS";

export const DEPARTMENT_LABELS = {
  admin: "admin",
  export: "出口部",
  domestic: "国内部",
  technical: "技术部",
  finance: "财务部"
} as const;

export const ROLE_LABELS = {
  staff: "业务员",
  manager: "经理",
  admin: "管理员",
  super_admin: "超级管理员"
} as const;

export const PERMISSION_GROUPS: Array<{ group: string; reserved?: boolean; items: Array<[PermissionKey, string]> }> = [
  {
    group: "系统管理",
    items: [
      ["admin.dashboard.view", "查看 admin 首页"],
      ["users.view", "用户查看"],
      ["users.create", "用户创建"],
      ["users.edit", "用户编辑"],
      ["users.disable", "启用 / 停用用户"],
      ["permissions.manage", "权限管理"]
    ]
  },
  { group: "部门入口", items: [["departments.view_all", "查看所有部门入口"]] },
  {
    group: "出口部",
    items: [
      ["export.dashboard.view", "进入出口部首页"],
      ["export.customers.view_own", "查看自己客户"],
      ["export.customers.view_all", "查看出口部全部客户"],
      ["export.customers.create", "新建出口部客户"],
      ["export.customers.edit_own", "编辑自己客户"],
      ["export.customers.edit_all", "编辑出口部全部客户"],
      ["export.customers.fields.manage", "管理出口部客户档案字段"]
    ]
  },
  { group: "国内部", reserved: true, items: [["domestic.dashboard.view", "查看国内部入口，暂未开放"]] },
  { group: "技术部", reserved: true, items: [["technical.dashboard.view", "查看技术部入口，暂未开放"]] },
  { group: "财务部", reserved: true, items: [["finance.dashboard.view", "查看财务部入口，暂未开放"]] }
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => group.items.map(([key]) => key));

export const ADMIN_DEFAULT_PERMISSIONS: PermissionKey[] = [
  "admin.dashboard.view",
  "departments.view_all",
  "export.dashboard.view",
  "export.customers.view_all",
  "export.customers.create",
  "export.customers.edit_all",
  "export.customers.fields.manage"
];

export const EXPORT_MANAGER_DEFAULT_PERMISSIONS: PermissionKey[] = [
  "export.dashboard.view",
  "export.customers.view_all",
  "export.customers.create",
  "export.customers.edit_all"
];

export const EXPORT_STAFF_DEFAULT_PERMISSIONS: PermissionKey[] = [
  "export.dashboard.view",
  "export.customers.view_own",
  "export.customers.create",
  "export.customers.edit_own"
];

export const CUSTOMER_FIELD_GROUPS: CustomerFieldGroup[] = [
  "基础信息",
  "联系人信息",
  "公司信息",
  "合作信息",
  "备注 / 特殊提醒"
];

export const CUSTOMER_FIELD_TYPES: CustomerFieldType[] = ["text", "textarea", "number", "date", "select", "boolean"];

export const CUSTOMER_TYPES = ["工厂", "贸易商", "终端客户", "代理商", "其他"];

export const CUSTOMER_STATUSES = ["新客户", "跟进中", "已报价", "已成交", "暂停合作", "已归档"];

export const CUSTOMER_SYSTEM_FIELD_KEYS = new Set([
  "name",
  "customerCode",
  "customerType",
  "country",
  "city",
  "source",
  "ownerUserId",
  "status",
  "createdAt",
  "updatedAt",
  "contactName",
  "contactTitle",
  "phone",
  "email",
  "wechatOrWhatsapp",
  "companyName",
  "companyWebsite",
  "companyAddress",
  "mainProducts",
  "purchaseNeed",
  "sourceNote",
  "expectedPurchaseNeed",
  "customerNotes",
  "internalNotes",
  "specialReminder"
]);

export const CUSTOMER_READONLY_FORM_FIELDS = new Set(["customerCode", "createdAt", "updatedAt"]);

export function defaultCustomerFields(now: string): CustomerFieldConfig[] {
  const rows: Array<[string, string, CustomerFieldType, CustomerFieldGroup, boolean, number, string[]?]> = [
    ["name", "客户名称", "text", "基础信息", true, 10],
    ["customerCode", "客户编号", "text", "基础信息", false, 20],
    ["customerType", "客户类型", "select", "基础信息", true, 30, CUSTOMER_TYPES],
    ["country", "国家 / 地区", "text", "基础信息", false, 40],
    ["city", "城市", "text", "基础信息", false, 50],
    ["source", "客户来源", "text", "基础信息", false, 60],
    ["ownerUserId", "负责业务员", "text", "基础信息", true, 70],
    ["status", "客户状态", "select", "基础信息", true, 80, CUSTOMER_STATUSES],
    ["createdAt", "创建时间", "date", "基础信息", false, 90],
    ["updatedAt", "更新时间", "date", "基础信息", false, 100],
    ["contactName", "联系人姓名", "text", "联系人信息", false, 110],
    ["contactTitle", "职位", "text", "联系人信息", false, 120],
    ["phone", "电话", "text", "联系人信息", false, 130],
    ["email", "邮箱", "text", "联系人信息", false, 140],
    ["wechatOrWhatsapp", "WhatsApp / 微信", "text", "联系人信息", false, 150],
    ["companyName", "公司名称", "text", "公司信息", false, 160],
    ["companyWebsite", "公司网站", "text", "公司信息", false, 170],
    ["companyAddress", "公司地址", "textarea", "公司信息", false, 180],
    ["mainProducts", "主营产品", "textarea", "公司信息", false, 190],
    ["purchaseNeed", "主要产品需求", "textarea", "合作信息", false, 200],
    ["sourceNote", "客户来源说明", "textarea", "合作信息", false, 210],
    ["expectedPurchaseNeed", "预计采购需求", "textarea", "合作信息", false, 220],
    ["customerNotes", "客户备注", "textarea", "备注 / 特殊提醒", false, 230],
    ["internalNotes", "内部备注", "textarea", "备注 / 特殊提醒", false, 240],
    ["specialReminder", "特殊提醒", "textarea", "备注 / 特殊提醒", false, 250]
  ];

  return rows.map(([fieldKey, fieldLabel, fieldType, fieldGroup, required, sortOrder, options = []]) => ({
    id: `fld_${fieldKey}`,
    moduleKey: "export_customer",
    fieldKey,
    fieldLabel,
    fieldType,
    fieldGroup,
    required,
    options,
    sortOrder,
    isActive: true,
    isSystemField: true,
    createdAt: now,
    updatedAt: now
  }));
}
