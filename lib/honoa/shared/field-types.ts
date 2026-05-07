import type { CustomerFieldType } from "./domain-types";

export const FIELD_TYPE_LABELS: Record<CustomerFieldType, string> = {
  text: "单行文本",
  textarea: "多行文本",
  number: "数字",
  date: "日期",
  select: "下拉选择",
  multiselect: "多选",
  boolean: "是/否",
  url: "超链接",
  attachment: "附件"
};

export const FIELD_TYPE_DESCRIPTIONS: Record<CustomerFieldType, string> = {
  text: "短文本",
  textarea: "长备注",
  number: "数字输入",
  date: "日期选择",
  select: "只能选择一个选项",
  multiselect: "可以选择多个选项",
  boolean: "布尔选择",
  url: "保存链接标题和链接地址",
  attachment: "上传或关联客户附件"
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
