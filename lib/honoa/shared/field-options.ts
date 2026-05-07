import type { CustomerFieldOption } from "./domain-types";

export type NormalizedFieldOption = {
  value: string;
  label: string;
  internalNote: string;
  isActive: boolean;
  sortOrder: number;
};

export function normalizeFieldOptions(options: unknown): NormalizedFieldOption[] {
  if (!Array.isArray(options)) return [];
  const normalized = options
    .map((option, index) => normalizeFieldOption(option, index))
    .filter((option): option is NormalizedFieldOption => Boolean(option?.value));
  return Array.from(new Map(normalized.map((option) => [option.value, option])).values())
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "zh-CN"));
}

export function activeFieldOptions(options: unknown) {
  return normalizeFieldOptions(options).filter((option) => option.isActive);
}

export function fieldOptionLabel(options: unknown, value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";
  return normalizeFieldOptions(options).find((option) => option.value === rawValue)?.label || rawValue;
}

export function fieldOptionValues(options: unknown) {
  return normalizeFieldOptions(options).map((option) => option.value);
}

export function parseFieldOptionsText(text: string): CustomerFieldOption[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      const [value, label, internalNote, state] = parts;
      if (!label && !internalNote && !state) return value;
      return {
        value,
        label: label || value,
        internalNote: internalNote || undefined,
        isActive: !["disabled", "停用", "inactive", "false", "0"].includes(String(state || "").toLowerCase()),
        sortOrder: index
      };
    });
}

export function serializeFieldOptions(options: unknown) {
  return normalizeFieldOptions(options)
    .map((option) => {
      if (!option.internalNote && option.isActive && option.label === option.value) return option.value;
      const state = option.isActive ? "" : "disabled";
      return [option.value, option.label, option.internalNote, state].join(" | ").replace(/( \| )+$/g, "");
    })
    .join("\n");
}

function normalizeFieldOption(option: unknown, index: number): NormalizedFieldOption | null {
  if (typeof option === "string") {
    const value = option.trim();
    return value ? { value, label: value, internalNote: "", isActive: true, sortOrder: index } : null;
  }
  if (!option || typeof option !== "object" || Array.isArray(option)) return null;
  const record = option as Record<string, unknown>;
  const value = String(record.value ?? record.label ?? "").trim();
  if (!value) return null;
  const label = String(record.label ?? value).trim() || value;
  const internalNote = String(record.internalNote ?? "").trim();
  const sortOrder = Number(record.sortOrder);
  return {
    value,
    label,
    internalNote,
    isActive: record.isActive === false ? false : true,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : index
  };
}
