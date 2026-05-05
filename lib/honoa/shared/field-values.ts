import { booleanFieldValueLabel } from "./field-types";
import type { CustomerFieldType } from "./domain-types";

export function displayFieldValue(value: unknown, fieldType?: string) {
  if (fieldType === "boolean") return booleanFieldValueLabel(value);
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export function isBooleanLike(value: unknown) {
  if (value === true || value === false) return true;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "false", "1", "0", "yes", "no", "是", "否"].includes(normalized);
}

export function isFieldValueCompatible(value: unknown, fieldType: CustomerFieldType, options: string[] = []) {
  if (value === null || value === undefined || value === "") return true;
  if (fieldType === "number") return Number.isFinite(Number(value));
  if (fieldType === "date") return !Number.isNaN(Date.parse(String(value)));
  if (fieldType === "boolean") return isBooleanLike(value);
  if (fieldType === "select") return options.length === 0 || options.includes(String(value));
  return true;
}

export function fieldValueCompatibilityMessage(value: unknown, fieldType: CustomerFieldType, options: string[] = []) {
  if (value === null || value === undefined || value === "") return null;
  if (fieldType === "select" && options.length > 0 && !options.includes(String(value))) {
    return "历史值，不在当前选项中。";
  }
  if (!isFieldValueCompatible(value, fieldType, options)) {
    return "历史值与当前字段类型不完全匹配，请重新确认。";
  }
  return null;
}
