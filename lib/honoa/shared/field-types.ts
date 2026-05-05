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
  if (value === true || value === "true" || value === "1") return "是";
  if (value === false || value === "false" || value === "0") return "否";
  return "未填写";
}
