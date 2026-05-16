import type { PrismaClient } from "@prisma/client";
import { assertNonProductionDatabaseUrl } from "./source-staging-repository";
import type {
  CreateQuoteCandidateAmountInput,
  QuoteCandidateAmountRepositoryOptions,
  QuoteCandidateAmountSourceKey,
  QuoteCandidateAmountStorageRecord
} from "./candidate-amount-repository-types";
import type {
  QuoteCandidateAmountCurrency,
  QuoteCandidateAmountSource,
  QuoteCandidateAmountStatus,
  QuoteCandidateAmountTradeMode,
  QuoteCandidateAmountVisibility
} from "./candidate-amount-types";

type QuoteCandidateAmountPrisma = Pick<PrismaClient, "quoteCandidateAmount">;

type StoredQuoteCandidateAmount = Awaited<ReturnType<PrismaClient["quoteCandidateAmount"]["create"]>>;

export const FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT_UAT_REASON = "finance_quote_candidate_amount_import_uat";

const SOURCES: QuoteCandidateAmountSource[] = [
  "finance_quote_source_staging",
  "manual_finance_review",
  "future_finance_pricing"
];

const STATUSES: QuoteCandidateAmountStatus[] = [
  "candidate_available",
  "missing",
  "requires_finance_review",
  "not_finance_approved"
];

const VISIBILITIES: QuoteCandidateAmountVisibility[] = [
  "finance_only",
  "export_draft_visible",
  "masked_for_export"
];

const TRADE_MODES: QuoteCandidateAmountTradeMode[] = [
  "export_usd",
  "domestic_cny",
  "unknown"
];

const CURRENCIES: QuoteCandidateAmountCurrency[] = ["USD", "CNY"];

const SENSITIVE_CANDIDATE_AMOUNT_FIELDS = [
  "amount",
  "unitPrice",
  "costPrice",
  "quotePrice",
  "salesPrice",
  "approvedPrice",
  "financeApprovedPrice",
  "minimumPrice",
  "grossMargin",
  "margin",
  "profit",
  "sentToCustomer",
  "officialQuote",
  "excelRows",
  "rawRow",
  "fullRow",
  "columns",
  "signedUrl",
  "accessKey",
  "storageKey"
] as const;

export async function findQuoteCandidateAmountBySourceKey(
  prisma: QuoteCandidateAmountPrisma,
  key: QuoteCandidateAmountSourceKey,
  options: QuoteCandidateAmountRepositoryOptions = {}
): Promise<QuoteCandidateAmountStorageRecord | null> {
  assertCandidateAmountRepositoryWriteAllowed(options);
  assertNoSensitiveCandidateAmountFields(key);
  assertAllowed(key.tradeMode, TRADE_MODES, "invalid quote candidate amount tradeMode");

  const existing = await prisma.quoteCandidateAmount.findFirst({
    where: {
      stagingRowId: key.stagingRowId,
      tradeMode: key.tradeMode,
      sourceColumnName: key.sourceColumnName,
      sourceColumnDate: key.sourceColumnDate
    }
  });

  return existing ? mapQuoteCandidateAmount(existing) : null;
}

export async function createQuoteCandidateAmount(
  prisma: QuoteCandidateAmountPrisma,
  input: CreateQuoteCandidateAmountInput,
  options: QuoteCandidateAmountRepositoryOptions = {}
): Promise<QuoteCandidateAmountStorageRecord> {
  assertCandidateAmountRepositoryWriteAllowed(options);
  assertNoSensitiveCandidateAmountFields(input);

  const source = input.source ?? "finance_quote_source_staging";
  const status = input.status ?? "not_finance_approved";
  const visibility = input.visibility ?? "finance_only";

  assertCandidateAmountStorageBoundary(input, status, visibility);

  assertAllowed(input.tradeMode, TRADE_MODES, "invalid quote candidate amount tradeMode");
  assertAllowed(input.currency, CURRENCIES, "invalid quote candidate amount currency");
  assertAllowed(source, SOURCES, "invalid quote candidate amount source");
  assertAllowed(status, STATUSES, "invalid quote candidate amount status");
  assertAllowed(visibility, VISIBILITIES, "invalid quote candidate amount visibility");
  assertCandidateValue(input.candidateValue);

  const existing = await findQuoteCandidateAmountBySourceKey(
    prisma,
    {
      stagingRowId: input.stagingRowId,
      tradeMode: input.tradeMode,
      sourceColumnName: input.sourceColumnName ?? "",
      sourceColumnDate: input.sourceColumnDate ?? ""
    },
    options
  );

  if (existing) {
    throw new Error("quote candidate amount already imported for this staging row and source column");
  }

  const created = await prisma.quoteCandidateAmount.create({
    data: {
      stagingBatchId: input.stagingBatchId,
      stagingRowId: input.stagingRowId,
      sourceUploadId: input.sourceUploadId,
      sourceColumnName: input.sourceColumnName,
      sourceColumnDate: input.sourceColumnDate,
      tradeMode: input.tradeMode,
      currency: input.currency,
      candidateValue: input.candidateValue,
      source,
      status,
      visibility,
      isFinanceApprovedPrice: false,
      canBeSentToCustomer: false,
      requiresFinancePricing: true,
      importedByUserId: input.importedByUserId,
      importedByName: input.importedByName,
      warnings: input.warnings ?? []
    }
  });

  return mapQuoteCandidateAmount(created);
}

export async function deleteQuoteCandidateAmountsForTest(
  prisma: QuoteCandidateAmountPrisma,
  filter: { stagingBatchId: string },
  options: QuoteCandidateAmountRepositoryOptions = {}
) {
  assertCandidateAmountRepositoryWriteAllowed(options);

  await prisma.quoteCandidateAmount.deleteMany({
    where: {
      stagingBatchId: filter.stagingBatchId
    }
  });
}

export function assertNoSensitiveCandidateAmountFields(value: unknown, path: string[] = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveCandidateAmountFields(item, [...path, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    const normalizedKey = key.toLowerCase();
    const sensitiveField = SENSITIVE_CANDIDATE_AMOUNT_FIELDS.find((field) =>
      normalizedKey.includes(field.toLowerCase())
    );
    if (sensitiveField) {
      throw new Error(`quote candidate amount cannot include sensitive fields: ${[...path, key].join(".")}`);
    }
    assertNoSensitiveCandidateAmountFields((value as Record<string, unknown>)[key], [...path, key]);
  }
}

function assertCandidateAmountRepositoryWriteAllowed(options: QuoteCandidateAmountRepositoryOptions = {}) {
  if (process.env.NODE_ENV === "production") {
    if (
      options.allowControlledProductionWrite &&
      options.productionWriteReason === FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT_UAT_REASON
    ) {
      return;
    }
    if (options.allowControlledProductionWrite) {
      throw new Error("controlled production write reason is invalid for quote candidate amount repository writes");
    }
    throw new Error("quote candidate amount repository writes are disabled in production");
  }

  assertNonProductionDatabaseUrl(options.databaseUrl);
}

function assertCandidateAmountStorageBoundary(
  input: CreateQuoteCandidateAmountInput,
  status: QuoteCandidateAmountStatus,
  visibility: QuoteCandidateAmountVisibility
) {
  const rawInput = input as CreateQuoteCandidateAmountInput & {
    isFinanceApprovedPrice?: unknown;
    canBeSentToCustomer?: unknown;
    requiresFinancePricing?: unknown;
  };

  if (visibility !== "finance_only") {
    throw new Error("quote candidate amount visibility must be finance_only");
  }
  if (status !== "not_finance_approved") {
    throw new Error("quote candidate amount status must be not_finance_approved");
  }
  if ("isFinanceApprovedPrice" in rawInput && rawInput.isFinanceApprovedPrice !== false) {
    throw new Error("quote candidate amount cannot be FinanceApprovedPrice");
  }
  if ("canBeSentToCustomer" in rawInput && rawInput.canBeSentToCustomer !== false) {
    throw new Error("quote candidate amount cannot be sent to customer");
  }
  if ("requiresFinancePricing" in rawInput && rawInput.requiresFinancePricing !== true) {
    throw new Error("quote candidate amount must require FinancePricing");
  }
}

function assertCandidateValue(value: string) {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error("quote candidate amount candidateValue must be a decimal string");
  }
}

function assertAllowed<T extends string>(value: string, allowedValues: readonly T[], message: string): asserts value is T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(message);
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapQuoteCandidateAmount(record: StoredQuoteCandidateAmount): QuoteCandidateAmountStorageRecord {
  return {
    id: record.id,
    stagingBatchId: record.stagingBatchId,
    stagingRowId: record.stagingRowId,
    sourceUploadId: record.sourceUploadId ?? undefined,
    sourceColumnName: record.sourceColumnName ?? undefined,
    sourceColumnDate: record.sourceColumnDate ?? undefined,
    tradeMode: record.tradeMode as QuoteCandidateAmountTradeMode,
    currency: record.currency as QuoteCandidateAmountCurrency,
    candidateValue: record.candidateValue.toString(),
    source: record.source as QuoteCandidateAmountSource,
    status: record.status as QuoteCandidateAmountStatus,
    visibility: record.visibility as QuoteCandidateAmountVisibility,
    isFinanceApprovedPrice: false,
    canBeSentToCustomer: false,
    requiresFinancePricing: true,
    importedByUserId: record.importedByUserId ?? undefined,
    importedByName: record.importedByName ?? undefined,
    importedAt: record.importedAt.toISOString(),
    warnings: asStringArray(record.warnings),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
