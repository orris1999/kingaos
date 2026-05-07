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
  | "export.customers.duplicate_review.view"
  | "export.customers.duplicate_review.manage"
  | "export.customers.receipt_account.select"
  | "finance.receipt_accounts.view"
  | "finance.receipt_accounts.manage"
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

export type CustomerFieldType = "text" | "textarea" | "number" | "date" | "select" | "multiselect" | "boolean" | "url" | "attachment";

export type CustomerFieldGroup = "基础信息" | "联系人信息" | "公司信息" | "合作信息" | "备注 / 特殊提醒";

export type CustomerFieldOption =
  | string
  | {
      value: string;
      label: string;
      internalNote?: string;
      isActive?: boolean;
      sortOrder?: number;
    };

export type CustomerFieldConfig = {
  id: string;
  moduleKey: "export_customer";
  fieldKey: string;
  fieldLabel: string;
  fieldType: CustomerFieldType;
  fieldGroup: CustomerFieldGroup;
  required: boolean;
  options: CustomerFieldOption[];
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
  customerIdentityId?: string | null;
  normalizedCustomerName?: string | null;
  duplicateApprovalStatus?: "none" | "approved_duplicate" | "needs_duplicate_review";
  duplicateApprovalRequestId?: string | null;
  duplicateApprovedByUserId?: string | null;
  duplicateApprovedByName?: string | null;
  duplicateApprovedAt?: string | null;
  duplicateApprovalReason?: string | null;
  defaultReceiptAccountId?: string | null;
  defaultReceiptAccountSelectedAt?: string | null;
  defaultReceiptAccountSelectedByUserId?: string | null;
  defaultReceiptAccountSelectedByName?: string | null;
  defaultReceiptAccountNote?: string | null;
  customerType: string;
  customerTypes?: string[] | null;
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
  customFields: Record<string, unknown>;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type CustomerIdentity = {
  id: string;
  scope: "export_customer";
  displayName: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDuplicateReviewRequest = {
  id: string;
  department: "export";
  moduleKey: "export_customer";
  requestedByUserId: string;
  requestedByName?: string | null;
  proposedCustomerName: string;
  normalizedName: string;
  existingIdentityId?: string | null;
  existingCustomerIds: string[];
  requestedPayload: Record<string, unknown>;
  requestReason?: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decidedByUserId?: string | null;
  decidedByName?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExportCustomerInput = Partial<Omit<ExportCustomer, "id" | "customerCode" | "department" | "ownerName" | "createdByUserId" | "createdAt" | "updatedAt" | "archivedAt">> & {
  name: string;
  ownerUserId?: string;
  customFields?: Record<string, unknown>;
  duplicateApprovalReason?: string;
  allowDuplicateWithApproval?: boolean;
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
