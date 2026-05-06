import { booleanFieldValueLabel } from "./field-types";

export type FieldHistoryConfig = {
  fieldKey: string;
  fieldLabel: string;
  fieldGroup?: string | null;
  fieldType?: string | null;
  options?: string[];
};

export type ReceiptAccountHistorySummary = {
  id: string;
  displayName: string;
  accountCode: string;
} | null;

export type CustomerFieldHistoryDraft = {
  fieldKey: string;
  fieldLabel: string;
  fieldGroup?: string | null;
  fieldKind: "system" | "custom" | "relation";
  fieldType?: string | null;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  oldDisplayValue: string;
  newDisplayValue: string;
  changeType: "set" | "update" | "clear";
  source: "customer_edit" | "receipt_account_select";
  metadata?: Record<string, string | null>;
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

export function displayHistoryValue(value: unknown, fieldType?: string | null) {
  if (isEmptyHistoryValue(value)) return "未填写";
  if (fieldType === "boolean") return booleanFieldValueLabel(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "无法显示的历史值";
    }
  }
  return String(value);
}

export function receiptAccountHistoryDisplay(account: ReceiptAccountHistorySummary) {
  if (!account) return "未设置";
  return `${account.displayName} / ${account.accountCode}`;
}

export function historyChangeType(oldValue: unknown, newValue: unknown): CustomerFieldHistoryDraft["changeType"] {
  if (isEmptyHistoryValue(oldValue) && !isEmptyHistoryValue(newValue)) return "set";
  if (!isEmptyHistoryValue(oldValue) && isEmptyHistoryValue(newValue)) return "clear";
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
      fieldKind: "system",
      oldValue: normalizeHistoryScalar(oldCustomer[fieldKey]),
      newValue: normalizeHistoryScalar(newCustomer[fieldKey]),
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
    appendFieldHistoryDraft(drafts, {
      fieldKey,
      fieldLabel: config?.fieldLabel || `未知字段：${fieldKey}`,
      fieldGroup: config?.fieldGroup,
      fieldType: config?.fieldType,
      fieldKind: "custom",
      oldValue: normalizeHistoryScalar(oldCustomFields[fieldKey]),
      newValue: normalizeHistoryScalar(newCustomFields[fieldKey]),
      source: "customer_edit",
      metadata: config ? { customFieldId: config.fieldKey } : undefined
    });
  }

  return drafts;
}

function appendFieldHistoryDraft(
  drafts: CustomerFieldHistoryDraft[],
  draft: Omit<CustomerFieldHistoryDraft, "oldDisplayValue" | "newDisplayValue" | "changeType">
) {
  if (historyValuesEqual(draft.oldValue, draft.newValue)) return;
  drafts.push({
    ...draft,
    oldDisplayValue: displayHistoryValue(draft.oldValue, draft.fieldType),
    newDisplayValue: displayHistoryValue(draft.newValue, draft.fieldType),
    changeType: historyChangeType(draft.oldValue, draft.newValue)
  });
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

function normalizeHistoryScalar(value: unknown): CustomerFieldHistoryDraft["oldValue"] {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  return String(value).trim();
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeHistoryScalar(value);
  if (normalized === null || normalized === "") return null;
  return String(normalized);
}

function isEmptyHistoryValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function historyValuesEqual(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function unionKeys(a: Record<string, unknown>, b: Record<string, unknown>) {
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
}
