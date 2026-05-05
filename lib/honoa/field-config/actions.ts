import {
  CUSTOMER_FIELD_GROUPS,
  CUSTOMER_FIELD_TYPES,
  defaultCustomerFields
} from "../shared/constants";
import type { CustomerFieldConfig, CustomerFieldGroup, CustomerFieldType, User } from "../shared/domain-types";
import type { KingaStore } from "../shared/mock-store";
import { newId, nowIso } from "../shared/mock-store";
import { hasPermission } from "../permissions/actions";

type FieldConfigInput = {
  fieldLabel: string;
  fieldType: CustomerFieldType;
  fieldGroup: CustomerFieldGroup;
  required: boolean;
  options: string[];
  sortOrder: number;
  isActive: boolean;
};

export function ensureDefaultCustomerFieldConfigs(store: KingaStore) {
  if (store.getCustomerFieldConfigs().length === 0) {
    store.saveCustomerFieldConfigs(defaultCustomerFields(nowIso()));
  }
}

export function listCustomerFieldConfigs(store: KingaStore, actor?: User, includeInactive = false): CustomerFieldConfig[] {
  ensureDefaultCustomerFieldConfigs(store);
  if (includeInactive && actor && !hasPermission(store, actor, "export.customers.fields.manage")) {
    throw new Error("当前账号不能配置出口部客户档案字段。");
  }
  return store
    .getCustomerFieldConfigs()
    .filter((field) => field.moduleKey === "export_customer")
    .filter((field) => includeInactive || field.isActive)
    .sort((a, b) => {
      const groupDelta = CUSTOMER_FIELD_GROUPS.indexOf(a.fieldGroup) - CUSTOMER_FIELD_GROUPS.indexOf(b.fieldGroup);
      if (groupDelta !== 0) return groupDelta;
      return a.sortOrder - b.sortOrder;
    });
}

export function createCustomerFieldConfig(store: KingaStore, actor: User, input: FieldConfigInput): CustomerFieldConfig {
  assertCanManageFields(store, actor);
  validateFieldInput(input);
  const now = nowIso();
  const field: CustomerFieldConfig = {
    id: newId("fld"),
    moduleKey: "export_customer",
    fieldKey: uniqueFieldKey(store, input.fieldLabel),
    fieldLabel: input.fieldLabel.trim(),
    fieldType: input.fieldType,
    fieldGroup: input.fieldGroup,
    required: input.required,
    options: input.options,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 300,
    isActive: input.isActive,
    isSystemField: false,
    createdAt: now,
    updatedAt: now
  };
  store.saveCustomerFieldConfigs([...store.getCustomerFieldConfigs(), field]);
  return field;
}

export function updateCustomerFieldConfig(store: KingaStore, actor: User, fieldId: string, input: FieldConfigInput): CustomerFieldConfig {
  assertCanManageFields(store, actor);
  validateFieldInput(input);
  const fields = store.getCustomerFieldConfigs();
  const existing = fields.find((field) => field.id === fieldId);
  if (!existing) throw new Error("字段不存在。");
  const next = {
    ...existing,
    fieldLabel: input.fieldLabel.trim(),
    fieldGroup: input.fieldGroup,
    fieldType: existing.isSystemField ? existing.fieldType : input.fieldType,
    required: input.required,
    options: input.options,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : existing.sortOrder,
    isActive: input.isActive,
    updatedAt: nowIso()
  };
  store.saveCustomerFieldConfigs(fields.map((field) => (field.id === fieldId ? next : field)));
  return next;
}

export function disableCustomerFieldConfig(store: KingaStore, actor: User, fieldId: string): CustomerFieldConfig {
  const field = store.getCustomerFieldConfigs().find((item) => item.id === fieldId);
  if (!field) throw new Error("字段不存在。");
  return updateCustomerFieldConfig(store, actor, fieldId, {
    ...field,
    isActive: false
  });
}

function assertCanManageFields(store: KingaStore, actor: User) {
  if (!hasPermission(store, actor, "export.customers.fields.manage")) {
    throw new Error("当前账号不能配置出口部客户档案字段。");
  }
}

function validateFieldInput(input: FieldConfigInput) {
  if (!input.fieldLabel.trim()) throw new Error("请填写字段名称。");
  if (!CUSTOMER_FIELD_GROUPS.includes(input.fieldGroup)) throw new Error("字段分组无效。");
  if (!CUSTOMER_FIELD_TYPES.includes(input.fieldType)) throw new Error("字段类型无效。");
}

function uniqueFieldKey(store: KingaStore, label: string): string {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  let key = `custom_${normalized || "field"}`;
  let index = 1;
  const keys = new Set(store.getCustomerFieldConfigs().map((field) => field.fieldKey));
  while (keys.has(key)) {
    index += 1;
    key = `custom_${normalized || "field"}_${index}`;
  }
  return key;
}
