import { booleanFieldValueLabel } from "./field-types";

export function displayFieldValue(value: unknown, fieldType?: string) {
  if (fieldType === "boolean") return booleanFieldValueLabel(value);
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
