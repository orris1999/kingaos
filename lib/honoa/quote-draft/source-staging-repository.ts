import type { PrismaClient } from "@prisma/client";
import type {
  CreateQuoteSourceStagingBatchInput,
  CreateQuoteSourceStagingRowInput,
  QuoteSourceStagingBatchFilter,
  QuoteSourceStagingRepositoryOptions,
  QuoteSourceStagingRowFilter,
  QuoteSourceStagingStatusActor
} from "./source-staging-repository-types";
import type {
  QuoteSourceStagingBatch,
  QuoteSourceStagingBatchStatus,
  QuoteSourceStagingPriceCandidateStatus,
  QuoteSourceStagingRow,
  QuoteSourceStagingRowStatus,
  QuoteSourceStagingVisibility
} from "./source-staging-types";
import { assertQuoteSourceStagingBatchTransition } from "./source-staging-status";

type QuoteSourceStagingPrisma = Pick<
  PrismaClient,
  "quoteSourceStagingBatch" | "quoteSourceStagingRow"
>;

type StoredBatch = Awaited<ReturnType<PrismaClient["quoteSourceStagingBatch"]["create"]>>;
type StoredRow = Awaited<ReturnType<PrismaClient["quoteSourceStagingRow"]["create"]>>;
type StoredBatchWithRows = StoredBatch & { rows: StoredRow[] };

const SENSITIVE_PRICE_FIELDS = [
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

export const FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON = "finance_quote_source_row_import_uat";
export const FINANCE_STAGING_CONFIRM_UAT_REASON = "finance_staging_confirm_uat";

type ControlledProductionWriteContext = "quote_source_staging_rows" | "quote_source_staging_confirmation";

const BATCH_STATUSES: QuoteSourceStagingBatchStatus[] = [
  "draft",
  "dry_run_passed",
  "finance_confirmed",
  "adapter_fix_required",
  "finance_table_fix_required",
  "cancelled"
];

const ROW_STATUSES: QuoteSourceStagingRowStatus[] = [
  "candidate",
  "needs_manual_review",
  "addon_only",
  "blocked",
  "ignored"
];

const VISIBILITIES: QuoteSourceStagingVisibility[] = [
  "finance_only",
  "export_draft_candidate",
  "internal_risk_only"
];

const PRICE_CANDIDATE_STATUSES: QuoteSourceStagingPriceCandidateStatus[] = [
  "cost_candidate_available",
  "quote_candidate_available",
  "missing",
  "not_finance_approved",
  "requires_finance_review"
];

export function assertNonProductionDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL,
  options: QuoteSourceStagingRepositoryOptions = {},
  controlledProductionWriteContext?: ControlledProductionWriteContext
) {
  if (process.env.NODE_ENV === "production") {
    const controlledProductionWriteAllowed =
      options.allowControlledProductionWrite &&
      ((controlledProductionWriteContext === "quote_source_staging_rows" &&
        options.productionWriteReason === FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON) ||
        (controlledProductionWriteContext === "quote_source_staging_confirmation" &&
          options.productionWriteReason === FINANCE_STAGING_CONFIRM_UAT_REASON));
    if (controlledProductionWriteAllowed) {
      return;
    }
    if (options.allowControlledProductionWrite) {
      throw new Error("controlled production write reason is invalid for quote source staging repository writes");
    }
    throw new Error("quote source staging repository writes are disabled in production");
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for quote source staging repository writes");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is invalid for quote source staging repository writes");
  }

  const host = parsed.hostname.toLowerCase();
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const allowedLocalHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const safeDatabaseName =
    databaseName.includes("dev") ||
    databaseName.includes("test") ||
    databaseName.includes("verify") ||
    databaseName.includes("local");

  if (!allowedLocalHosts.has(host)) {
    throw new Error("quote source staging repository writes require a local/test database host");
  }

  if (/rds|aliyuncs|amazonaws|prod|production/.test(host) || /prod|production/.test(databaseName)) {
    throw new Error("quote source staging repository writes refuse production-like database URLs");
  }

  if (!safeDatabaseName) {
    throw new Error("quote source staging repository writes require a dev/test/verify/local database");
  }
}

export async function createQuoteSourceStagingBatch(
  prisma: QuoteSourceStagingPrisma,
  input: CreateQuoteSourceStagingBatchInput,
  options: QuoteSourceStagingRepositoryOptions = {}
): Promise<QuoteSourceStagingBatch> {
  assertNonProductionDatabaseUrl(options.databaseUrl, options);
  assertNoSensitivePriceFields(input);

  const submittedByRole = input.submittedByRole ?? "finance";
  const consumerDepartment = input.consumerDepartment ?? "export";
  const status = input.status ?? "draft";

  assertEquals(submittedByRole, "finance", "submittedByRole must be finance");
  assertEquals(consumerDepartment, "export", "consumerDepartment must be export");
  assertAllowed(status, BATCH_STATUSES, "invalid quote source staging batch status");

  const batch = await prisma.quoteSourceStagingBatch.create({
    data: {
      sourceFileName: input.sourceFileName,
      adapterId: input.adapterId,
      category: input.category,
      submittedByRole,
      consumerDepartment,
      dryRunDecisionStatus: input.dryRunDecisionStatus,
      status,
      createdByUserId: input.createdByUserId,
      createdByName: input.createdByName,
      confirmedByUserId: input.confirmedByUserId,
      confirmedByName: input.confirmedByName,
      confirmedAt: input.confirmedAt ? new Date(input.confirmedAt) : undefined,
      warnings: input.warnings ?? [],
      notes: input.notes
    }
  });

  return mapBatch(batch);
}

export async function createQuoteSourceStagingRows(
  prisma: QuoteSourceStagingPrisma,
  batchId: string,
  rows: CreateQuoteSourceStagingRowInput[],
  options: QuoteSourceStagingRepositoryOptions = {}
): Promise<QuoteSourceStagingRow[]> {
  assertNonProductionDatabaseUrl(options.databaseUrl, options, "quote_source_staging_rows");

  const createdRows: QuoteSourceStagingRow[] = [];

  for (const row of rows) {
    assertNoSensitivePriceFields(row);
    assertControlledProductionRowVisibility(row, options);
    assertEquals(row.batchId, batchId, "row batchId must match the target batchId");
    assertAllowed(row.rowStatus, ROW_STATUSES, "invalid quote source staging row status");
    assertAllowed(row.visibility, VISIBILITIES, "invalid quote source staging visibility");
    assertAllowed(
      row.priceCandidateStatus,
      PRICE_CANDIDATE_STATUSES,
      "invalid quote source staging price candidate status"
    );
    assertRowVisibilityAllowed(row.rowStatus, row.visibility);

    const created = await prisma.quoteSourceStagingRow.create({
      data: {
        batchId,
        sourceRowNumber: row.sourceRowNumber,
        rawKjCode: row.rawKjCode,
        standardKjCode: row.standardKjCode,
        baseKjCode: row.baseKjCode,
        oldKjNo: row.oldKjNo,
        fumacrmCode: row.fumacrmCode,
        dingjieCodeWithoutCap: row.dingjieCodeWithoutCap,
        dingjieCodeWithCap: row.dingjieCodeWithCap,
        productNameCandidate: row.productNameCandidate,
        category: row.category,
        modelCandidate: row.modelCandidate,
        specificationCandidate: row.specificationCandidate,
        tradeMode: row.tradeMode ?? "unknown",
        priceCandidateStatus: row.priceCandidateStatus,
        hasCostCandidate: row.hasCostCandidate,
        hasQuoteCandidate: row.hasQuoteCandidate,
        hasPackagingInfo: row.hasPackagingInfo,
        hasOemInfo: row.hasOemInfo,
        visibility: row.visibility,
        rowStatus: row.rowStatus,
        warnings: row.warnings ?? []
      }
    });

    createdRows.push(mapRow(created));
  }

  return createdRows;
}

export async function getQuoteSourceStagingBatchById(
  prisma: QuoteSourceStagingPrisma,
  batchId: string,
  options: QuoteSourceStagingRepositoryOptions = {}
): Promise<(QuoteSourceStagingBatch & { rows: QuoteSourceStagingRow[] }) | null> {
  assertNonProductionDatabaseUrl(options.databaseUrl, options);

  const batch = await prisma.quoteSourceStagingBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        orderBy: [{ sourceRowNumber: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  return batch ? mapBatchWithRows(batch) : null;
}

export async function listQuoteSourceStagingBatches(
  prisma: QuoteSourceStagingPrisma,
  filter: QuoteSourceStagingBatchFilter = {},
  options: QuoteSourceStagingRepositoryOptions = {}
): Promise<QuoteSourceStagingBatch[]> {
  assertNonProductionDatabaseUrl(options.databaseUrl, options);

  if (filter.status) {
    assertAllowed(filter.status, BATCH_STATUSES, "invalid quote source staging batch status");
  }

  const batches = await prisma.quoteSourceStagingBatch.findMany({
    where: {
      status: filter.status,
      adapterId: filter.adapterId,
      category: filter.category
    },
    orderBy: { createdAt: "desc" }
  });

  return batches.map(mapBatch);
}

export async function listQuoteSourceStagingRows(
  prisma: QuoteSourceStagingPrisma,
  batchId: string,
  filter: QuoteSourceStagingRowFilter = {},
  options: QuoteSourceStagingRepositoryOptions = {}
): Promise<QuoteSourceStagingRow[]> {
  assertNonProductionDatabaseUrl(options.databaseUrl, options);

  if (filter.rowStatus) {
    assertAllowed(filter.rowStatus, ROW_STATUSES, "invalid quote source staging row status");
  }
  if (filter.visibility) {
    assertAllowed(filter.visibility, VISIBILITIES, "invalid quote source staging visibility");
  }

  const rows = await prisma.quoteSourceStagingRow.findMany({
    where: {
      batchId,
      rowStatus: filter.rowStatus,
      visibility: filter.visibility
    },
    orderBy: [{ sourceRowNumber: "asc" }, { createdAt: "asc" }]
  });

  return rows.map(mapRow);
}

export async function updateQuoteSourceStagingBatchStatus(
  prisma: QuoteSourceStagingPrisma,
  batchId: string,
  nextStatus: QuoteSourceStagingBatchStatus,
  actor: QuoteSourceStagingStatusActor = {},
  options: QuoteSourceStagingRepositoryOptions = {}
): Promise<QuoteSourceStagingBatch> {
  assertNonProductionDatabaseUrl(options.databaseUrl, options);
  assertNoSensitivePriceFields(actor);
  assertAllowed(nextStatus, BATCH_STATUSES, "invalid quote source staging batch status");

  const currentBatch = await prisma.quoteSourceStagingBatch.findUnique({
    where: { id: batchId }
  });

  if (!currentBatch) {
    throw new Error("quote source staging batch not found");
  }

  const currentStatus = currentBatch.status as QuoteSourceStagingBatchStatus;
  assertQuoteSourceStagingBatchTransition(currentStatus, nextStatus);

  const batch = await prisma.quoteSourceStagingBatch.update({
    where: { id: batchId },
    data: {
      status: nextStatus,
      confirmedByUserId: nextStatus === "finance_confirmed" ? actor.userId : undefined,
      confirmedByName: nextStatus === "finance_confirmed" ? actor.name : undefined,
      confirmedAt: nextStatus === "finance_confirmed" ? new Date() : undefined,
      notes: nextStatus === "cancelled" ? actor.notes ?? actor.reason ?? currentBatch.notes : undefined,
      warnings:
        nextStatus === "cancelled" && actor.warnings
          ? [...asStringArray(currentBatch.warnings), ...actor.warnings]
          : undefined
    }
  });

  return mapBatch(batch);
}

function assertRowVisibilityAllowed(
  rowStatus: QuoteSourceStagingRowStatus,
  visibility: QuoteSourceStagingVisibility
) {
  if (rowStatus === "addon_only" && visibility === "export_draft_candidate") {
    throw new Error("addon_only rows cannot be export_draft_candidate");
  }

  if ((rowStatus === "blocked" || rowStatus === "ignored") && visibility === "export_draft_candidate") {
    throw new Error("blocked or ignored rows cannot be export_draft_candidate");
  }
}

function assertControlledProductionRowVisibility(
  row: CreateQuoteSourceStagingRowInput,
  options: QuoteSourceStagingRepositoryOptions
) {
  if (!options.allowControlledProductionWrite) return;
  if (options.productionWriteReason !== FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON) return;
  if (row.visibility === "export_draft_candidate") {
    throw new Error("controlled production row import cannot create export_draft_candidate rows");
  }
}

function assertNoSensitivePriceFields(value: unknown, path: string[] = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitivePriceFields(item, [...path, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (SENSITIVE_PRICE_FIELDS.includes(key as (typeof SENSITIVE_PRICE_FIELDS)[number])) {
      throw new Error(
        `staging metadata cannot include sensitive price fields: ${[...path, key].join(".")}`
      );
    }
    assertNoSensitivePriceFields((value as Record<string, unknown>)[key], [...path, key]);
  }
}

function assertAllowed<T extends string>(value: string, allowedValues: readonly T[], message: string): asserts value is T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(message);
  }
}

function assertEquals<T extends string>(actual: string, expected: T, message: string): asserts actual is T {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapBatch(batch: StoredBatch): QuoteSourceStagingBatch {
  return {
    id: batch.id,
    sourceFileName: batch.sourceFileName,
    adapterId: batch.adapterId,
    category: batch.category ?? "",
    submittedByRole: "finance",
    consumerDepartment: "export",
    dryRunDecisionStatus: batch.dryRunDecisionStatus as QuoteSourceStagingBatch["dryRunDecisionStatus"],
    status: batch.status as QuoteSourceStagingBatchStatus,
    createdByUserId: batch.createdByUserId ?? undefined,
    createdAt: batch.createdAt.toISOString(),
    confirmedByUserId: batch.confirmedByUserId ?? undefined,
    confirmedAt: batch.confirmedAt?.toISOString(),
    warnings: asStringArray(batch.warnings),
    notes: batch.notes ?? undefined
  };
}

function mapBatchWithRows(batch: StoredBatchWithRows): QuoteSourceStagingBatch & { rows: QuoteSourceStagingRow[] } {
  return {
    ...mapBatch(batch),
    rows: batch.rows.map(mapRow)
  };
}

function mapRow(row: StoredRow): QuoteSourceStagingRow {
  return {
    id: row.id,
    batchId: row.batchId,
    sourceRowNumber: row.sourceRowNumber ?? undefined,
    rawKjCode: row.rawKjCode ?? undefined,
    standardKjCode: row.standardKjCode ?? undefined,
    baseKjCode: row.baseKjCode ?? undefined,
    oldKjNo: row.oldKjNo ?? undefined,
    fumacrmCode: row.fumacrmCode ?? undefined,
    dingjieCodeWithoutCap: row.dingjieCodeWithoutCap ?? undefined,
    dingjieCodeWithCap: row.dingjieCodeWithCap ?? undefined,
    productNameCandidate: row.productNameCandidate ?? undefined,
    category: row.category ?? undefined,
    modelCandidate: row.modelCandidate ?? undefined,
    specificationCandidate: row.specificationCandidate ?? undefined,
    tradeMode: row.tradeMode as QuoteSourceStagingRow["tradeMode"],
    priceCandidateStatus: row.priceCandidateStatus as QuoteSourceStagingPriceCandidateStatus,
    hasCostCandidate: row.hasCostCandidate,
    hasQuoteCandidate: row.hasQuoteCandidate,
    hasPackagingInfo: row.hasPackagingInfo,
    hasOemInfo: row.hasOemInfo,
    visibility: row.visibility as QuoteSourceStagingVisibility,
    rowStatus: row.rowStatus as QuoteSourceStagingRowStatus,
    warnings: asStringArray(row.warnings)
  };
}
