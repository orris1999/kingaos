import type { CustomerFieldType } from "./domain-types";

export const FIELD_TYPE_LABELS: Record<CustomerFieldType, string> = {
  text: "单行文本",
  textarea: "多行文本",
  number: "数字",
  date: "日期",
  select: "下拉选择",
  boolean: "是/否"
};

export function fieldTypeLabel(fieldType: CustomerFieldType) {
  return FIELD_TYPE_LABELS[fieldType] ?? fieldType;
}

export function booleanFieldValueLabel(value: unknown) {
  if (value === true || ["true", "1", "yes", "是"].includes(String(value).trim().toLowerCase())) return "是";
  if (value === false || ["false", "0", "no", "否"].includes(String(value).trim().toLowerCase())) return "否";
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}
