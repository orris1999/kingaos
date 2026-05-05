export type Department = "export" | "domestic" | "technical" | "finance" | "admin";

export type Role = "staff" | "manager" | "admin" | "super_admin";

export type PermissionKey =
  | "admin.dashboard.view"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.disable"
  | "permissions.manage"
  | "departments.view_all"
  | "export.dashboard.view"
  | "export.customers.view_own"
  | "export.customers.view_all"
  | "export.customers.create"
  | "export.customers.edit_own"
  | "export.customers.edit_all"
  | "export.customers.fields.manage"
  | "domestic.dashboard.view"
  | "technical.dashboard.view"
  | "finance.dashboard.view";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  department: Department;
  role: Role;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type UserPermission = {
  userId: string;
  permissionKey: PermissionKey;
};

export type CustomerFieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean";

export type CustomerFieldGroup = "基础信息" | "联系人信息" | "公司信息" | "合作信息" | "备注 / 特殊提醒";

export type CustomerFieldConfig = {
  id: string;
  moduleKey: "export_customer";
  fieldKey: string;
  fieldLabel: string;
  fieldType: CustomerFieldType;
  fieldGroup: CustomerFieldGroup;
  required: boolean;
  options: string[];
  sortOrder: number;
  isActive: boolean;
  isSystemField: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExportCustomer = {
  id: string;
  customerCode: string;
  name: string;
  customerType: string;
  country: string;
  countryCode: string | null;
  countryName: string | null;
  stateCode: string | null;
  stateName: string | null;
  cityName: string | null;
  city: string;
  source: string;
  status: string;
  ownerUserId: string;
  ownerName: string;
  department: "export";
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  wechatOrWhatsapp: string;
  companyName: string;
  companyWebsite: string;
  companyAddress: string;
  mainProducts: string;
  purchaseNeed: string;
  sourceNote: string;
  expectedPurchaseNeed: string;
  customerNotes: string;
  internalNotes: string;
  specialReminder: string;
  customFields: Record<string, string | boolean | number>;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ExportCustomerInput = Partial<Omit<ExportCustomer, "id" | "customerCode" | "department" | "ownerName" | "createdByUserId" | "createdAt" | "updatedAt" | "archivedAt">> & {
  name: string;
  ownerUserId?: string;
  customFields?: Record<string, string | boolean | number>;
};

export type UserInput = {
  name: string;
  email: string;
  password?: string;
  department: Department;
  role: Role;
  isActive: boolean;
  permissions: PermissionKey[];
};
