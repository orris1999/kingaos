import type { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import type { AuthUser } from "./auth";
import { prisma } from "./db";
import { isFinanceQuoteCandidateAmountImportEnabled } from "./feature-flags";
import { readQuoteSourceUploadObjectBuffer } from "./quote-source-upload-dry-run";
import {
  QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS,
  getQuoteSourceWorkbookConfig,
  importQuoteCandidateAmounts,
  type QuoteCandidateAmountTradeMode,
  type QuoteCandidateAmountWorkbookRowLike
} from "../quote-draft";
import type { QuoteSourceSheetConfig } from "../quote-draft";

type QuoteCandidateAmountImportPrisma = Pick<
  PrismaClient,
  "quoteSourceStagingBatch" | "quoteSourceStagingRow" | "quoteSourceUpload" | "quoteCandidateAmount" | "auditLog" | "$transaction"
>;

export type ImportQuoteCandidateAmountsActionInput = {
  batchId: string;
  tradeModes: QuoteCandidateAmountTradeMode[];
};

export type ImportQuoteCandidateAmountsActionResult = {
  batchId: string;
  tradeModes: QuoteCandidateAmountTradeMode[];
  rowCount: number;
  candidateAmountCount: number;
  skippedCount: number;
  currencies: string[];
  visibility: "finance_only";
  status: "not_finance_approved";
  warnings: string[];
};

type ImportQuoteCandidateAmountsActionOptions = {
  db?: QuoteCandidateAmountImportPrisma;
  databaseUrl?: string;
  importEnabled?: boolean;
  readObjectBuffer?: (upload: { storageKey: string }) => Promise<Buffer>;
  workbookRows?: QuoteCandidateAmountWorkbookRowLike[];
};

type CandidateAmountBatchRow = {
  id: string;
  sourceRowNumber: number | null;
  visibility: string;
  rowStatus: string;
  priceCandidateStatus: string;
};

const SUPPORTED_ADAPTER_ID = "condenser-cost-2026";
const SUPPORTED_CATEGORY = "冷凝器";
const ALLOWED_TRADE_MODES: QuoteCandidateAmountTradeMode[] = ["export_usd", "domestic_cny", "unknown"];
const IMPORTABLE_PRICE_STATUSES = new Set(["cost_candidate_available", "quote_candidate_available", "not_finance_approved"]);
const FORBIDDEN_RESULT_KEYS = [
  "candidateValue",
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
  "signedUrl",
  "accessKey",
  "storageKey",
  "rawRow",
  "fullRow",
  "excelRows",
  "columns"
] as const;

function assertNoForbiddenResultKeys(value: unknown) {
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      const forbidden = FORBIDDEN_RESULT_KEYS.find((field) => normalizedKey === field.toLowerCase());
      if (forbidden) {
        throw new Error(`candidate amount import result cannot include forbidden field: ${forbidden}`);
      }
      stack.push(nested);
    }
  }
}

function assertCanImportCandidateAmounts(actor: AuthUser) {
  if (actor.role !== "super_admin") {
    throw new Error("当前账号不能执行候选金额导入。");
  }
}

function normalizeTradeModes(tradeModes: QuoteCandidateAmountTradeMode[]) {
  const normalized = Array.from(new Set(tradeModes));
  if (normalized.length === 0) {
    throw new Error("候选金额导入至少需要一个 tradeMode。");
  }
  for (const tradeMode of normalized) {
    if (!ALLOWED_TRADE_MODES.includes(tradeMode)) {
      throw new Error("候选金额导入 tradeMode 不合法。");
    }
  }
  return normalized;
}

function isImportableStagingRow(row: CandidateAmountBatchRow) {
  return (
    row.visibility === "export_draft_candidate" &&
    row.rowStatus === "candidate" &&
    IMPORTABLE_PRICE_STATUSES.has(row.priceCandidateStatus)
  );
}

function assertBatchCanImportCandidateAmounts(batch: {
  status: string;
  adapterId: string;
  category: string | null;
  rows: CandidateAmountBatchRow[];
}) {
  if (batch.status !== "finance_confirmed") {
    throw new Error("只有 finance_confirmed 状态的 staging batch 可以导入候选金额。");
  }
  if (batch.adapterId !== SUPPORTED_ADAPTER_ID) {
    throw new Error("009P 第一版只支持 condenser-cost-2026 adapter。");
  }
  if (batch.category !== SUPPORTED_CATEGORY) {
    throw new Error("009P 第一版只支持冷凝器 category。");
  }
  if (!batch.rows.some(isImportableStagingRow)) {
    throw new Error("当前 staging batch 没有可导入候选金额的 export_draft_candidate rows。");
  }
}

function assertUploadCanImportCandidateAmounts(upload: {
  uploadStatus: string;
  dryRunStatus: string | null;
  stagingBatchId: string | null;
  storageKey: string;
}, batchId: string) {
  if (upload.uploadStatus !== "uploaded") {
    throw new Error("只有 uploaded 状态的报价表上传记录可以导入候选金额。");
  }
  if (upload.dryRunStatus !== "completed") {
    throw new Error("只有 dryRunStatus=completed 的报价表上传记录可以导入候选金额。");
  }
  if (upload.stagingBatchId !== batchId) {
    throw new Error("报价表上传记录未关联到当前 staging batch。");
  }
  if (!upload.storageKey) {
    throw new Error("报价表上传记录缺少 storageKey，不能导入候选金额。");
  }
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function getPrimarySheetConfig(adapterId: string) {
  const config = getQuoteSourceWorkbookConfig(adapterId);
  if (!config || adapterId !== SUPPORTED_ADAPTER_ID) {
    throw new Error("009P candidate amount parser first version only supports condenser-cost-2026 / 冷凝器。");
  }
  const sheetConfig = config.primarySheets[0];
  if (!sheetConfig) {
    throw new Error("candidate amount parser requires a primary sheet config");
  }
  return sheetConfig;
}

function pickSheetName(workbook: XLSX.WorkBook, sheetConfig: QuoteSourceSheetConfig) {
  const hintedSheetName = sheetConfig.sheetNameHint
    ? workbook.SheetNames.find((name) => name.includes(sheetConfig.sheetNameHint ?? ""))
    : undefined;

  return hintedSheetName ?? workbook.SheetNames[0];
}

function extractCurrentCandidateAmountColumns(
  worksheet: XLSX.WorkSheet,
  headerRowIndex: number,
  sourceRowNumber: number
) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  const rowIndex = sourceRowNumber - 1;
  const columns: Record<string, unknown> = {};
  const sourceColumnNames = Object.values(QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS).map((column) => column.sourceColumnName);
  const normalizedSourceNames = new Set(sourceColumnNames.map(normalizeHeader));

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex })];
    const header = headerCell?.v;
    if (!normalizedSourceNames.has(normalizeHeader(header))) continue;
    const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
    columns[String(header).trim()] = cell?.v;
  }

  return columns;
}

function parseCandidateAmountWorkbookRowsFromBuffer(input: {
  fileBuffer: Buffer;
  adapterId: string;
  stagingRows: CandidateAmountBatchRow[];
}): QuoteCandidateAmountWorkbookRowLike[] {
  const sheetConfig = getPrimarySheetConfig(input.adapterId);
  const workbook = XLSX.read(input.fileBuffer, { type: "buffer", cellDates: false });
  const sheetName = pickSheetName(workbook, sheetConfig);
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  const headerRowIndex = typeof sheetConfig.headerRowHint === "number"
    ? sheetConfig.headerRowHint - 1
    : range.s.r;
  return input.stagingRows
    .filter(isImportableStagingRow)
    .filter((row) => typeof row.sourceRowNumber === "number")
    .map((row) => ({
      stagingRowId: row.id,
      sourceRowNumber: row.sourceRowNumber ?? undefined,
      columns: extractCurrentCandidateAmountColumns(worksheet, headerRowIndex, row.sourceRowNumber ?? 0)
    }));
}

function filterWorkbookRowsForImportableRows(
  workbookRows: QuoteCandidateAmountWorkbookRowLike[],
  batchRows: CandidateAmountBatchRow[]
) {
  const importableRowIds = new Set(batchRows.filter(isImportableStagingRow).map((row) => row.id));
  return workbookRows.filter((row) => importableRowIds.has(row.stagingRowId));
}

async function getQuoteSourceUploadByStagingBatchId(stagingBatchId: string, db: QuoteCandidateAmountImportPrisma) {
  return db.quoteSourceUpload.findFirst({
    where: { stagingBatchId },
    select: {
      id: true,
      sourceFileName: true,
      storageKey: true,
      uploadStatus: true,
      dryRunStatus: true,
      stagingBatchId: true
    }
  });
}

function buildSanitizedResult(input: {
  batchId: string;
  tradeModes: QuoteCandidateAmountTradeMode[];
  rowCount: number;
  candidateAmountCount: number;
  skippedCount: number;
  currencies: string[];
  warnings: string[];
}): ImportQuoteCandidateAmountsActionResult {
  const result: ImportQuoteCandidateAmountsActionResult = {
    batchId: input.batchId,
    tradeModes: input.tradeModes,
    rowCount: input.rowCount,
    candidateAmountCount: input.candidateAmountCount,
    skippedCount: input.skippedCount,
    currencies: Array.from(new Set(input.currencies)),
    visibility: "finance_only",
    status: "not_finance_approved",
    warnings: input.warnings
  };
  assertNoForbiddenResultKeys(result);
  return result;
}

export async function importQuoteCandidateAmountsForBatch(
  actor: AuthUser,
  input: ImportQuoteCandidateAmountsActionInput,
  options: ImportQuoteCandidateAmountsActionOptions = {}
): Promise<ImportQuoteCandidateAmountsActionResult> {
  assertCanImportCandidateAmounts(actor);
  if (!(options.importEnabled ?? isFinanceQuoteCandidateAmountImportEnabled())) {
    throw new Error("财务候选金额导入暂未开放。");
  }

  const tradeModes = normalizeTradeModes(input.tradeModes);
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const db = options.db ?? prisma;
  const batch = await db.quoteSourceStagingBatch.findUnique({
    where: { id: input.batchId },
    include: {
      rows: {
        select: {
          id: true,
          sourceRowNumber: true,
          visibility: true,
          rowStatus: true,
          priceCandidateStatus: true
        }
      }
    }
  });
  if (!batch) throw new Error("staging batch 不存在。");
  assertBatchCanImportCandidateAmounts(batch);

  const upload = await getQuoteSourceUploadByStagingBatchId(batch.id, db);
  if (!upload) {
    throw new Error("未找到与该 staging batch 关联的报价表上传记录。");
  }
  assertUploadCanImportCandidateAmounts(upload, batch.id);

  const importableRows = batch.rows.filter(isImportableStagingRow);
  const workbookRows = options.workbookRows
    ? filterWorkbookRowsForImportableRows(options.workbookRows, batch.rows)
    : parseCandidateAmountWorkbookRowsFromBuffer({
        fileBuffer: await (options.readObjectBuffer ?? readQuoteSourceUploadObjectBuffer)(upload),
        adapterId: batch.adapterId,
        stagingRows: importableRows
      });

  const result = await db.$transaction(async (tx) => {
    const currentBatch = await tx.quoteSourceStagingBatch.findUnique({
      where: { id: batch.id },
      include: {
        rows: {
          select: {
            id: true,
            sourceRowNumber: true,
            visibility: true,
            rowStatus: true,
            priceCandidateStatus: true
          }
        }
      }
    });
    if (!currentBatch) throw new Error("staging batch 不存在。");
    assertBatchCanImportCandidateAmounts(currentBatch);

    const currentWorkbookRows = filterWorkbookRowsForImportableRows(workbookRows, currentBatch.rows);
    const imported = await importQuoteCandidateAmounts(
      tx,
      {
        stagingBatchId: currentBatch.id,
        sourceUploadId: upload.id,
        adapterId: currentBatch.adapterId,
        category: currentBatch.category ?? "",
        rows: currentWorkbookRows,
        tradeModes,
        importedByUserId: actor.id,
        importedByName: actor.name
      },
      { databaseUrl }
    );

    const auditMetadata = {
      batchId: currentBatch.id,
      tradeModes,
      rowCount: currentWorkbookRows.length,
      candidateAmountCount: imported.records.length,
      currency: Array.from(new Set(imported.records.map((record) => record.currency))),
      visibility: "finance_only",
      status: "not_finance_approved",
      actorUserId: actor.id,
      actorName: actor.name
    };
    assertNoForbiddenResultKeys(auditMetadata);

    if (imported.records.length > 0) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "quote_candidate_amount.imported",
          entityType: "QuoteSourceStagingBatch",
          entityId: currentBatch.id,
          metadata: auditMetadata
        }
      });
    }

    return buildSanitizedResult({
      batchId: currentBatch.id,
      tradeModes,
      rowCount: currentWorkbookRows.length,
      candidateAmountCount: imported.records.length,
      skippedCount: imported.skipped.length,
      currencies: imported.records.map((record) => record.currency),
      warnings: imported.warnings
    });
  });

  return result;
}
