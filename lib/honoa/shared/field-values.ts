import { booleanFieldValueLabel } from "./field-types";
import type { CustomerFieldType } from "./domain-types";
import { fieldOptionLabel, fieldOptionValues } from "./field-options";

export type UrlFieldValue = {
  label?: string;
  url: string;
};

export function displayFieldValue(value: unknown, fieldType?: string, options: unknown = []) {
  if (fieldType === "boolean") return booleanFieldValueLabel(value);
  if (fieldType === "select") return fieldOptionLabel(options, value) || "-";
  if (fieldType === "multiselect") {
    const values = normalizeMultiValue(value);
    return values.length ? values.map((item) => fieldOptionLabel(options, item) || item).join("、") : "-";
  }
  if (fieldType === "url") {
    const link = normalizeUrlFieldValue(value);
    if (!link) return "-";
    return link.label ? `${link.label} / ${link.url}` : link.url;
  }
  if (fieldType === "attachment") {
    const ids = normalizeMultiValue(value);
    return ids.length ? `${ids.length} 个附件` : "-";
  }
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export function isBooleanLike(value: unknown) {
  if (value === true || value === false) return true;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "false", "1", "0", "yes", "no", "是", "否"].includes(normalized);
}

export function isFieldValueCompatible(value: unknown, fieldType: CustomerFieldType, options: unknown = []) {
  if (value === null || value === undefined || value === "") return true;
  if (fieldType === "number") return Number.isFinite(Number(value));
  if (fieldType === "date") return !Number.isNaN(Date.parse(String(value)));
  if (fieldType === "boolean") return isBooleanLike(value);
  if (fieldType === "select") {
    const values = fieldOptionValues(options);
    return values.length === 0 || values.includes(String(value));
  }
  if (fieldType === "multiselect") {
    const values = fieldOptionValues(options);
    const selected = normalizeMultiValue(value);
    return values.length === 0 || selected.every((item) => values.includes(item));
  }
  if (fieldType === "url") {
    const link = normalizeUrlFieldValue(value);
    return !link || isSafeUrl(link.url);
  }
  if (fieldType === "attachment") return Array.isArray(value) || typeof value === "string";
  return true;
}

export function fieldValueCompatibilityMessage(value: unknown, fieldType: CustomerFieldType, options: unknown = []) {
  if (value === null || value === undefined || value === "") return null;
  const optionValues = fieldOptionValues(options);
  if (fieldType === "select" && optionValues.length > 0 && !optionValues.includes(String(value))) {
    return "历史值，不在当前选项中。";
  }
  if (fieldType === "multiselect" && optionValues.length > 0 && !normalizeMultiValue(value).every((item) => optionValues.includes(item))) {
    return "历史值包含不在当前选项中的内容。";
  }
  if (fieldType === "url" && !isFieldValueCompatible(value, fieldType, options)) {
    return "链接地址无效或不安全，请重新确认。";
  }
  if (!isFieldValueCompatible(value, fieldType, options)) {
    return "历史值与当前字段类型不完全匹配，请重新确认。";
  }
  return null;
}

export function normalizeMultiValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeMultiValue(parsed);
    } catch {
      // Legacy comma-separated values are allowed below.
    }
    return trimmed.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeUrlFieldValue(value: unknown): UrlFieldValue | null {
  if (!value) return null;
  if (typeof value === "string") {
    const url = value.trim();
    return url ? { url } : null;
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const url = String(record.url ?? "").trim();
  if (!url) return null;
  const label = String(record.label ?? "").trim();
  return label ? { label, url } : { url };
}

export function isSafeUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
