import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$210000$${salt}$${hash}`;
}

const ADMIN_DEFAULT_PERMISSIONS = [
  "admin.dashboard.view",
  "departments.view_all",
  "export.dashboard.view",
  "export.customers.view_all",
  "export.customers.create",
  "export.customers.edit_all",
  "export.customers.fields.manage",
  "export.customers.duplicate_review.view",
  "export.customers.duplicate_review.manage"
];

const EXPORT_MANAGER_DEFAULT_PERMISSIONS = [
  "export.dashboard.view",
  "export.customers.view_all",
  "export.customers.create",
  "export.customers.edit_all",
  "export.customers.duplicate_review.view",
  "export.customers.duplicate_review.manage"
];

const EXPORT_STAFF_DEFAULT_PERMISSIONS = [
  "export.dashboard.view",
  "export.customers.view_own",
  "export.customers.create",
  "export.customers.edit_own"
];

const CUSTOMER_TYPES = ["工厂", "贸易商", "终端客户", "代理商", "其他"];
const CUSTOMER_STATUSES = ["新客户", "跟进中", "已报价", "已成交", "暂停合作", "已归档"];

function defaultCustomerFields() {
  return [
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
  ].map(([fieldKey, fieldLabel, fieldType, fieldGroup, required, sortOrder, options = []]) => ({
    moduleKey: "export_customer",
    fieldKey,
    fieldLabel,
    fieldType,
    fieldGroup,
    required,
    options,
    sortOrder,
    isActive: true,
    isSystemField: true
  }));
}

const seedUsers = [
  {
    name: "超级管理员",
    email: "superadmin@kingaos.local",
    password: "roserose",
    department: "admin",
    role: "super_admin",
    permissions: []
  },
  {
    name: "管理员",
    email: "admin@kingaos.local",
    password: "Kingaos@123456",
    department: "admin",
    role: "admin",
    permissions: ADMIN_DEFAULT_PERMISSIONS
  },
  {
    name: "出口部经理",
    email: "export.manager@kingaos.local",
    password: "Kingaos@123456",
    department: "export",
    role: "manager",
    permissions: EXPORT_MANAGER_DEFAULT_PERMISSIONS
  },
  {
    name: "出口部业务员A",
    email: "export.a@kingaos.local",
    password: "Kingaos@123456",
    department: "export",
    role: "staff",
    permissions: EXPORT_STAFF_DEFAULT_PERMISSIONS
  },
  {
    name: "出口部业务员B",
    email: "export.b@kingaos.local",
    password: "Kingaos@123456",
    department: "export",
    role: "staff",
    permissions: EXPORT_STAFF_DEFAULT_PERMISSIONS
  }
];

const permissionGroups = [
  {
    group: "系统管理",
    reserved: false,
    items: [
      ["admin.dashboard.view", "查看 admin 首页"],
      ["users.view", "用户查看"],
      ["users.create", "用户创建"],
      ["users.edit", "用户编辑"],
      ["users.disable", "启用 / 停用用户"],
      ["permissions.manage", "权限管理"]
    ]
  },
  { group: "部门入口", reserved: false, items: [["departments.view_all", "查看所有部门入口"]] },
  {
    group: "出口部",
    reserved: false,
    items: [
      ["export.dashboard.view", "进入出口部首页"],
      ["export.customers.view_own", "查看自己客户"],
      ["export.customers.view_all", "查看出口部全部客户"],
      ["export.customers.create", "新建出口部客户"],
      ["export.customers.edit_own", "编辑自己客户"],
      ["export.customers.edit_all", "编辑出口部全部客户"],
      ["export.customers.fields.manage", "管理出口部客户档案字段"],
      ["export.customers.duplicate_review.view", "查看重复客户审核"],
      ["export.customers.duplicate_review.manage", "审核重复客户例外"]
    ]
  },
  { group: "国内部", reserved: true, items: [["domestic.dashboard.view", "查看国内部入口，暂未开放"]] },
  { group: "技术部", reserved: true, items: [["technical.dashboard.view", "查看技术部入口，暂未开放"]] },
  { group: "财务部", reserved: true, items: [["finance.dashboard.view", "查看财务部入口，暂未开放"]] }
];

for (const group of permissionGroups) {
  for (const [key, label] of group.items) {
    await prisma.permission.upsert({
      where: { key },
      update: { label, group: group.group, reserved: group.reserved },
      create: { key, label, group: group.group, reserved: group.reserved }
    });
  }
}

for (const seedUser of seedUsers) {
  const user = await prisma.user.upsert({
    where: { email: seedUser.email },
    update: {
      name: seedUser.name,
      department: seedUser.department,
      role: seedUser.role,
      isActive: true
    },
    create: {
      name: seedUser.name,
      email: seedUser.email,
      passwordHash: hashPassword(seedUser.password),
      department: seedUser.department,
      role: seedUser.role,
      isActive: true
    }
  });

  await prisma.userPermission.deleteMany({ where: { userId: user.id } });
  if (seedUser.role !== "super_admin") {
    await prisma.userPermission.createMany({
      data: seedUser.permissions.map((permissionKey) => ({ userId: user.id, permissionKey })),
      skipDuplicates: true
    });
  }
}

for (const field of defaultCustomerFields()) {
  await prisma.customerFieldConfig.upsert({
    where: { moduleKey_fieldKey: { moduleKey: field.moduleKey, fieldKey: field.fieldKey } },
    update: {
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      fieldGroup: field.fieldGroup,
      required: field.required,
      options: field.options,
      sortOrder: field.sortOrder,
      isActive: field.isActive,
      isSystemField: field.isSystemField
    },
    create: {
      moduleKey: field.moduleKey,
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      fieldGroup: field.fieldGroup,
      required: field.required,
      options: field.options,
      sortOrder: field.sortOrder,
      isActive: field.isActive,
      isSystemField: field.isSystemField
    }
  });
}

await prisma.$disconnect();
console.log("KingaOS shared database seed complete.");
