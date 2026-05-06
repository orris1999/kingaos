import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY_CONFIRM = "I_UNDERSTAND_THIS_DELETES_SPAM_HISTORY";
const shouldApply = process.argv.includes("--apply");

function normalizeComparableValue(value, fieldType) {
  const normalized = normalizeStoredValue(value, fieldType);
  if (normalized === null) return "empty:null";
  if (typeof normalized === "object") return `json:${stableStringify(normalized)}`;
  return `${typeof normalized}:${String(normalized)}`;
}

function normalizeStoredValue(value, fieldType) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (fieldType === "boolean") {
      const booleanValue = parseBooleanValue(trimmed);
      return booleanValue === null ? trimmed : booleanValue;
    }
    if (fieldType === "number") {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : trimmed;
    }
    if (fieldType === "date") return normalizeDateValue(trimmed);
    return trimmed;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return fieldType === "date" ? normalizeDateValue(value.toISOString()) : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeNestedValue(item));
  if (typeof value === "object") return normalizeObjectValue(value);
  return String(value).trim() || null;
}

function normalizeNestedValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeNestedValue(item));
  if (typeof value === "object") return normalizeObjectValue(value);
  return String(value).trim();
}

function normalizeObjectValue(value) {
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = normalizeNestedValue(value[key]);
      return acc;
    }, {});
}

function parseBooleanValue(value) {
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "是"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "否"].includes(normalized)) return false;
  return null;
}

function normalizeDateValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function textContainsDeployMarker(history) {
  return [
    history.oldDisplayValue,
    history.newDisplayValue,
    JSON.stringify(history.oldValue ?? null),
    JSON.stringify(history.newValue ?? null)
  ].some((value) => String(value || "").includes("部署验证"));
}

function bothDisplayUnfilled(history) {
  return String(history.oldDisplayValue || "").trim() === "未填写" && String(history.newDisplayValue || "").trim() === "未填写";
}

function sameDisplay(history) {
  return String(history.oldDisplayValue || "").trim() === String(history.newDisplayValue || "").trim();
}

function normalizedEqual(history) {
  return normalizeComparableValue(history.oldValue, history.fieldType) === normalizeComparableValue(history.newValue, history.fieldType);
}

const histories = await prisma.customerFieldChangeHistory.findMany({
  orderBy: { changedAt: "desc" },
  select: {
    id: true,
    customerId: true,
    fieldKey: true,
    fieldLabel: true,
    fieldType: true,
    oldValue: true,
    newValue: true,
    oldDisplayValue: true,
    newDisplayValue: true,
    changedAt: true
  }
});

const unfilledToUnfilled = histories.filter(bothDisplayUnfilled);
const sameDisplayHistories = histories.filter(sameDisplay);
const normalizedEqualHistories = histories.filter(normalizedEqual);
const deployMarkerHistories = histories.filter(textContainsDeployMarker);
const candidatesById = new Map();

for (const history of [...normalizedEqualHistories, ...unfilledToUnfilled, ...deployMarkerHistories]) {
  candidatesById.set(history.id, history);
}

const candidates = [...candidatesById.values()].sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
const affectedCustomerIds = [...new Set(candidates.map((history) => history.customerId))].sort();

console.log("KingaOS customer field history spam cleanup");
console.log(`Mode: ${shouldApply ? "APPLY" : "DRY-RUN"}`);
console.log(`Total histories scanned: ${histories.length}`);
console.log(`未填写 -> 未填写 records: ${unfilledToUnfilled.length}`);
console.log(`oldDisplayValue === newDisplayValue records: ${sameDisplayHistories.length}`);
console.log(`oldValue/newValue normalized equal records: ${normalizedEqualHistories.length}`);
console.log(`Records containing 部署验证: ${deployMarkerHistories.length}`);
console.log(`Affected customers: ${affectedCustomerIds.length}`);
console.log(`Affected customerIds: ${affectedCustomerIds.join(", ") || "-"}`);
console.log(`Candidate histories to delete: ${candidates.length}`);
console.log("First candidate history ids:");
for (const history of candidates.slice(0, 20)) {
  console.log(`- ${history.id} | ${history.customerId} | ${history.fieldLabel} | ${history.oldDisplayValue || "未填写"} -> ${history.newDisplayValue || "未填写"}`);
}

if (!shouldApply) {
  console.log(`No database writes were made. To apply, set CLEANUP_CUSTOMER_HISTORY_SPAM_CONFIRM=${APPLY_CONFIRM} and run npm run cleanup:customer-history-spam:apply.`);
  await prisma.$disconnect();
  process.exit(0);
}

if (process.env.CLEANUP_CUSTOMER_HISTORY_SPAM_CONFIRM !== APPLY_CONFIRM) {
  console.error(`Refusing to delete history without CLEANUP_CUSTOMER_HISTORY_SPAM_CONFIRM=${APPLY_CONFIRM}.`);
  await prisma.$disconnect();
  process.exit(1);
}

const result = await prisma.customerFieldChangeHistory.deleteMany({
  where: { id: { in: candidates.map((history) => history.id) } }
});

console.log(`Deleted spam history records: ${result.count}`);
await prisma.$disconnect();
