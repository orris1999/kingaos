import type { PrismaClient } from "@prisma/client";
import {
  QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS,
  QUOTE_CANDIDATE_AMOUNT_WARNINGS,
  type QuoteCandidateAmountTradeMode
} from "./candidate-amount-types";
import { createQuoteCandidateAmount } from "./candidate-amount-repository";
import type {
  CreateQuoteCandidateAmountInput,
  QuoteCandidateAmountRepositoryOptions,
  QuoteCandidateAmountStorageRecord
} from "./candidate-amount-repository-types";

type QuoteCandidateAmountImportPrisma = Pick<PrismaClient, "quoteCandidateAmount">;

export type QuoteCandidateAmountWorkbookRowLike = {
  stagingRowId: string;
  sourceRowNumber?: number;
  columns: Record<string, unknown>;
};

export type ImportQuoteCandidateAmountsInput = {
  stagingBatchId: string;
  sourceUploadId?: string;
  adapterId: string;
  category: string;
  rows: QuoteCandidateAmountWorkbookRowLike[];
  tradeModes: QuoteCandidateAmountTradeMode[];
  importedByUserId?: string;
  importedByName?: string;
};

export type QuoteCandidateAmountImportSkippedReason =
  | "requires_finance_review"
  | "missing_candidate_value"
  | "invalid_candidate_value";

export type QuoteCandidateAmountImportSkippedRow = {
  stagingRowId: string;
  sourceRowNumber?: number;
  tradeMode: QuoteCandidateAmountTradeMode;
  reason: QuoteCandidateAmountImportSkippedReason;
  sourceColumnName?: string;
  sourceColumnDate?: string;
  warnings: string[];
};

export type QuoteCandidateAmountImportPlan = {
  candidates: CreateQuoteCandidateAmountInput[];
  skipped: QuoteCandidateAmountImportSkippedRow[];
  warnings: string[];
};

export type QuoteCandidateAmountImportedAuditMetadata = {
  stagingBatchId: string;
  sourceUploadId?: string;
  importedCount: number;
  tradeModes: QuoteCandidateAmountTradeMode[];
  sourceColumns: string[];
  visibility: "finance_only";
  status: "not_finance_approved";
};

export type QuoteCandidateAmountImportResult = QuoteCandidateAmountImportPlan & {
  records: QuoteCandidateAmountStorageRecord[];
  auditMetadata: QuoteCandidateAmountImportedAuditMetadata;
};

const SUPPORTED_ADAPTER_ID = "condenser-cost-2026";
const SUPPORTED_CATEGORY = "冷凝器";

const IMPORT_WARNINGS = {
  localOnly: "009O candidate amount importer only writes local/test DB data; production import requires a later UAT.",
  notFinanceApproved: QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFinanceApproved,
  notFormalQuote: QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFormalQuote,
  requiresFinancePricing: QUOTE_CANDIDATE_AMOUNT_WARNINGS.requiresFinancePricing,
  financeOnly: "候选金额导入默认 visibility=finance_only，出口部不可见。"
} as const;

function normalizeHeader(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.normalize("NFKC").trim();
  if (typeof value === "number") return String(value);
  return "";
}

function findExactColumnValue(columns: Record<string, unknown>, sourceColumnName: string) {
  const normalizedSourceColumn = normalizeHeader(sourceColumnName);
  const found = Object.entries(columns).find(([key]) => normalizeHeader(key) === normalizedSourceColumn);

  return found?.[1];
}

function parseCandidateValue(value: unknown) {
  const normalized = normalizeValue(value);
  if (!normalized) return { ok: false as const, reason: "missing_candidate_value" as const };

  const withoutCommas = normalized.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(withoutCommas)) {
    return { ok: false as const, reason: "invalid_candidate_value" as const };
  }

  return { ok: true as const, value: withoutCommas };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function assertSupportedInput(input: Pick<ImportQuoteCandidateAmountsInput, "adapterId" | "category">) {
  if (input.adapterId !== SUPPORTED_ADAPTER_ID || input.category !== SUPPORTED_CATEGORY) {
    throw new Error("009O candidate amount importer first version only supports condenser-cost-2026 / 冷凝器。");
  }
}

export function buildQuoteCandidateAmountImportPlan(
  input: ImportQuoteCandidateAmountsInput
): QuoteCandidateAmountImportPlan {
  assertSupportedInput(input);

  const candidates: CreateQuoteCandidateAmountInput[] = [];
  const skipped: QuoteCandidateAmountImportSkippedRow[] = [];

  for (const row of input.rows) {
    for (const tradeMode of input.tradeModes) {
      if (tradeMode === "unknown") {
        skipped.push({
          stagingRowId: row.stagingRowId,
          sourceRowNumber: row.sourceRowNumber,
          tradeMode,
          reason: "requires_finance_review",
          warnings: [
            QUOTE_CANDIDATE_AMOUNT_WARNINGS.unknownTradeMode,
            "unknown tradeMode 不自动导入候选金额。"
          ]
        });
        continue;
      }

      const sourceColumn = QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS[tradeMode];
      const rawValue = findExactColumnValue(row.columns, sourceColumn.sourceColumnName);
      const parsed = parseCandidateValue(rawValue);

      if (!parsed.ok) {
        skipped.push({
          stagingRowId: row.stagingRowId,
          sourceRowNumber: row.sourceRowNumber,
          tradeMode,
          reason: parsed.reason,
          sourceColumnName: sourceColumn.sourceColumnName,
          sourceColumnDate: sourceColumn.sourceColumnDate,
          warnings: [
            `未从当前候选列 ${sourceColumn.sourceColumnName} 读取到可导入的 mock 候选金额。`,
            "旧日期列不作为默认候选金额来源。"
          ]
        });
        continue;
      }

      candidates.push({
        stagingBatchId: input.stagingBatchId,
        stagingRowId: row.stagingRowId,
        sourceUploadId: input.sourceUploadId,
        sourceColumnName: sourceColumn.sourceColumnName,
        sourceColumnDate: sourceColumn.sourceColumnDate,
        tradeMode,
        currency: sourceColumn.currency,
        candidateValue: parsed.value,
        source: "finance_quote_source_staging",
        status: "not_finance_approved",
        visibility: "finance_only",
        importedByUserId: input.importedByUserId,
        importedByName: input.importedByName,
        warnings: unique([
          IMPORT_WARNINGS.localOnly,
          IMPORT_WARNINGS.notFinanceApproved,
          IMPORT_WARNINGS.notFormalQuote,
          IMPORT_WARNINGS.requiresFinancePricing,
          IMPORT_WARNINGS.financeOnly
        ])
      });
    }
  }

  return {
    candidates,
    skipped,
    warnings: unique([
      IMPORT_WARNINGS.localOnly,
      "第一版只导入 condenser-cost-2026 / 冷凝器的 2026.5.11 当前候选列。",
      "导入结果默认 finance_only，不给出口部消费，也不生成报价草稿或正式报价。"
    ])
  };
}

export async function importQuoteCandidateAmounts(
  prisma: QuoteCandidateAmountImportPrisma,
  input: ImportQuoteCandidateAmountsInput,
  options: QuoteCandidateAmountRepositoryOptions = {}
): Promise<QuoteCandidateAmountImportResult> {
  const plan = buildQuoteCandidateAmountImportPlan(input);
  const records: QuoteCandidateAmountStorageRecord[] = [];

  for (const candidate of plan.candidates) {
    records.push(await createQuoteCandidateAmount(prisma, candidate, options));
  }

  return {
    ...plan,
    records,
    auditMetadata: {
      stagingBatchId: input.stagingBatchId,
      sourceUploadId: input.sourceUploadId,
      importedCount: records.length,
      tradeModes: Array.from(new Set(records.map((record) => record.tradeMode))),
      sourceColumns: Array.from(new Set(records.map((record) => record.sourceColumnName).filter((item): item is string => Boolean(item)))),
      visibility: "finance_only",
      status: "not_finance_approved"
    }
  };
}
