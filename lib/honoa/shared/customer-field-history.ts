import { booleanFieldValueLabel } from "./field-types";
import { customerStatusLabel } from "./constants";
import { displayFieldValue } from "./field-values";
import type { CustomerFieldOption } from "./domain-types";

export type FieldHistoryConfig = {
  fieldKey: string;
  fieldLabel: string;
  fieldGroup?: string | null;
  fieldType?: string | null;
  options?: CustomerFieldOption[];
  isActive?: boolean;
};

export type ReceiptAccountHistorySummary = {
  id: string;
  displayName: string;
  accountCode: string;
} | null;

export type CustomerFieldHistoryStoredValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export type CustomerFieldHistoryDraft = {
  fieldKey: string;
  fieldLabel: string;
  fieldGroup?: string | null;
  fieldKind: "system" | "custom" | "relation";
  fieldType?: string | null;
  oldValue: CustomerFieldHistoryStoredValue;
  newValue: CustomerFieldHistoryStoredValue;
  oldDisplayValue: string;
  newDisplayValue: string;
  changeType: "set" | "update" | "clear";
  source: "customer_edit" | "receipt_account_select";
  metadata?: Record<string, string | null>;
};

export type CustomerFieldHistoryRecordLike = {
  fieldType?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  oldDisplayValue?: string | null;
  newDisplayValue?: string | null;
};

export const CUSTOMER_HISTORY_SYSTEM_FIELD_KEYS = [
  "status",
  "mainProducts",
  "purchaseNeed",
  "expectedPurchaseNeed",
  "sourceNote",
  "customerNotes",
  "internalNotes",
  "specialReminder"
] as const;

const FALLBACK_SYSTEM_FIELD_CONFIGS: Record<string, FieldHistoryConfig> = {
  status: { fieldKey: "status", fieldLabel: "客户状态", fieldGroup: "基础信息", fieldType: "select" },
  mainProducts: { fieldKey: "mainProducts", fieldLabel: "主营产品", fieldGroup: "公司信息", fieldType: "textarea" },
  purchaseNeed: { fieldKey: "purchaseNeed", fieldLabel: "主要产品需求", fieldGroup: "合作信息", fieldType: "textarea" },
  expectedPurchaseNeed: { fieldKey: "expectedPurchaseNeed", fieldLabel: "预计采购需求", fieldGroup: "合作信息", fieldType: "textarea" },
  sourceNote: { fieldKey: "sourceNote", fieldLabel: "客户来源说明", fieldGroup: "合作信息", fieldType: "textarea" },
  customerNotes: { fieldKey: "customerNotes", fieldLabel: "客户备注", fieldGroup: "备注 / 特殊提醒", fieldType: "textarea" },
  internalNotes: { fieldKey: "internalNotes", fieldLabel: "内部备注", fieldGroup: "备注 / 特殊提醒", fieldType: "textarea" },
  specialReminder: { fieldKey: "specialReminder", fieldLabel: "特殊提醒", fieldGroup: "备注 / 特殊提醒", fieldType: "textarea" }
};

export function normalizeHistoryComparableValue(value: unknown, fieldType?: string | null): string {
  const normalized = normalizeHistoryStoredValue(value, fieldType);
  if (normalized === null) return "empty:null";
  if (typeof normalized === "object") return `json:${stableStringify(normalized)}`;
  return `${typeof normalized}:${String(normalized)}`;
}

export function hasMeaningfulFieldChange(oldValue: unknown, newValue: unknown, fieldType?: string | null) {
  return normalizeHistoryComparableValue(oldValue, fieldType) !== normalizeHistoryComparableValue(newValue, fieldType);
}

export function displayHistoryValue(value: unknown, fieldType?: string | null, options: unknown = []) {
  const normalized = normalizeHistoryStoredValue(value, fieldType);
  if (normalized === null) return "未填写";
  if (["boolean", "select", "multiselect", "url", "attachment"].includes(String(fieldType || ""))) return displayFieldValue(normalized, String(fieldType || ""), options);
  if (fieldType === "number" && typeof normalized === "number") return String(normalized);
  if (typeof normalized === "object") {
    try {
      return stableStringify(normalized);
    } catch {
      return "无法显示的历史值";
    }
  }
  return String(normalized);
}

export function isMeaningfulHistoryRecord(record: CustomerFieldHistoryRecordLike) {
  const oldDisplay = normalizeDisplayText(record.oldDisplayValue);
  const newDisplay = normalizeDisplayText(record.newDisplayValue);
  if (oldDisplay === "未填写" && newDisplay === "未填写") return false;
  return hasMeaningfulFieldChange(record.oldValue, record.newValue, record.fieldType);
}

export function receiptAccountHistoryDisplay(account: ReceiptAccountHistorySummary) {
  if (!account) return "未设置";
  return `${account.displayName} / ${account.accountCode}`;
}

export function historyChangeType(oldValue: unknown, newValue: unknown): CustomerFieldHistoryDraft["changeType"] {
  if (isEmptyHistoryValue(normalizeHistoryStoredValue(oldValue)) && !isEmptyHistoryValue(normalizeHistoryStoredValue(newValue))) return "set";
  if (!isEmptyHistoryValue(normalizeHistoryStoredValue(oldValue)) && isEmptyHistoryValue(normalizeHistoryStoredValue(newValue))) return "clear";
  return "update";
}

export function buildCustomerFieldChangeHistoryDrafts({
  oldCustomer,
  newCustomer,
  oldCustomFields,
  newCustomFields,
  fieldConfigs,
  oldReceiptAccount,
  newReceiptAccount
}: {
  oldCustomer: Record<string, unknown>;
  newCustomer: Record<string, unknown>;
  oldCustomFields: Record<string, unknown>;
  newCustomFields: Record<string, unknown>;
  fieldConfigs: FieldHistoryConfig[];
  oldReceiptAccount?: ReceiptAccountHistorySummary;
  newReceiptAccount?: ReceiptAccountHistorySummary;
}) {
  const configs = new Map(fieldConfigs.map((field) => [field.fieldKey, field]));
  const drafts: CustomerFieldHistoryDraft[] = [];

  for (const fieldKey of CUSTOMER_HISTORY_SYSTEM_FIELD_KEYS) {
    const config = configs.get(fieldKey) || FALLBACK_SYSTEM_FIELD_CONFIGS[fieldKey];
    appendFieldHistoryDraft(drafts, {
      fieldKey,
      fieldLabel: config.fieldLabel,
      fieldGroup: config.fieldGroup,
      fieldType: config.fieldType,
      options: config.options,
      fieldKind: "system",
      oldValue: normalizeHistoryStoredValue(oldCustomer[fieldKey], config.fieldType),
      newValue: normalizeHistoryStoredValue(newCustomer[fieldKey], config.fieldType),
      source: "customer_edit"
    });
  }

  appendReceiptAccountHistoryDraft(drafts, {
    oldReceiptAccountId: normalizeNullableString(oldCustomer.defaultReceiptAccountId),
    newReceiptAccountId: normalizeNullableString(newCustomer.defaultReceiptAccountId),
    oldReceiptAccount,
    newReceiptAccount
  });

  for (const fieldKey of unionKeys(oldCustomFields, newCustomFields)) {
    const config = configs.get(fieldKey);
    if (config?.isActive === false) continue;
    appendFieldHistoryDraft(drafts, {
      fieldKey,
      fieldLabel: config?.fieldLabel || `未知字段：${fieldKey}`,
      fieldGroup: config?.fieldGroup,
      fieldType: config?.fieldType,
      options: config?.options,
      fieldKind: "custom",
      oldValue: normalizeHistoryStoredValue(oldCustomFields[fieldKey], config?.fieldType),
      newValue: normalizeHistoryStoredValue(newCustomFields[fieldKey], config?.fieldType),
      source: "customer_edit",
      metadata: config ? { customFieldId: config.fieldKey } : undefined
    });
  }

  return drafts;
}

function appendFieldHistoryDraft(
  drafts: CustomerFieldHistoryDraft[],
  draft: Omit<CustomerFieldHistoryDraft, "oldDisplayValue" | "newDisplayValue" | "changeType"> & { options?: unknown }
) {
  if (!hasMeaningfulFieldChange(draft.oldValue, draft.newValue, draft.fieldType)) return;
  const oldDisplayValue = draft.fieldKey === "status" ? displayStatusHistoryValue(draft.oldValue) : displayHistoryValue(draft.oldValue, draft.fieldType, draft.options);
  const newDisplayValue = draft.fieldKey === "status" ? displayStatusHistoryValue(draft.newValue) : displayHistoryValue(draft.newValue, draft.fieldType, draft.options);
  const { options: _options, ...record } = draft;
  drafts.push({
    ...record,
    oldDisplayValue,
    newDisplayValue,
    changeType: historyChangeType(draft.oldValue, draft.newValue)
  });
}

function displayStatusHistoryValue(value: unknown) {
  const displayValue = displayHistoryValue(value, "select");
  return displayValue === "未填写" ? displayValue : customerStatusLabel(displayValue);
}

function appendReceiptAccountHistoryDraft(
  drafts: CustomerFieldHistoryDraft[],
  {
    oldReceiptAccountId,
    newReceiptAccountId,
    oldReceiptAccount,
    newReceiptAccount
  }: {
    oldReceiptAccountId: string | null;
    newReceiptAccountId: string | null;
    oldReceiptAccount?: ReceiptAccountHistorySummary;
    newReceiptAccount?: ReceiptAccountHistorySummary;
  }
) {
  if (oldReceiptAccountId === newReceiptAccountId) return;
  drafts.push({
    fieldKey: "defaultReceiptAccountId",
    fieldLabel: "默认收款方案",
    fieldGroup: "合作信息",
    fieldKind: "relation",
    fieldType: "receipt_account",
    oldValue: oldReceiptAccountId,
    newValue: newReceiptAccountId,
    oldDisplayValue: receiptAccountHistoryDisplay(oldReceiptAccount || null),
    newDisplayValue: receiptAccountHistoryDisplay(newReceiptAccount || null),
    changeType: historyChangeType(oldReceiptAccountId, newReceiptAccountId),
    source: "receipt_account_select",
    metadata: {
      oldReceiptAccountId,
      newReceiptAccountId,
      oldReceiptAccountCode: oldReceiptAccount?.accountCode || null,
      newReceiptAccountCode: newReceiptAccount?.accountCode || null
    }
  });
}

function normalizeHistoryScalar(value: unknown): CustomerFieldHistoryStoredValue {
  const normalized = normalizeHistoryStoredValue(value);
  return normalized;
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeHistoryScalar(value);
  if (normalized === null || normalized === "") return null;
  return String(normalized);
}

function isEmptyHistoryValue(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function unionKeys(a: Record<string, unknown>, b: Record<string, unknown>) {
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
}

function normalizeHistoryStoredValue(value: unknown, fieldType?: string | null): CustomerFieldHistoryStoredValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (fieldType === "boolean") {
      const boolValue = parseBooleanHistoryValue(trimmed);
      return boolValue === null ? trimmed : boolValue;
    }
    if (fieldType === "number") {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : trimmed;
    }
    if (fieldType === "date") return normalizeDateHistoryValue(trimmed);
    return trimmed;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return fieldType === "date" ? normalizeDateHistoryValue(value.toISOString()) : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeNestedHistoryValue(item));
  if (typeof value === "object") return normalizeObjectHistoryValue(value as Record<string, unknown>);
  return String(value).trim() || null;
}

function normalizeNestedHistoryValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeNestedHistoryValue(item));
  if (typeof value === "object") return normalizeObjectHistoryValue(value as Record<string, unknown>);
  return String(value).trim();
}

function normalizeObjectHistoryValue(value: Record<string, unknown>) {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = normalizeNestedHistoryValue(value[key]);
      return acc;
    }, {});
}

function parseBooleanHistoryValue(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "是"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "否"].includes(normalized)) return false;
  return null;
}

function normalizeDateHistoryValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function normalizeDisplayText(value: unknown) {
  return String(value ?? "").trim();
}
