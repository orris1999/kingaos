import type { QuoteSourceUpload } from "@prisma/client";
import type { AuthUser } from "./auth";
import { prisma } from "./db";
import { assertQuoteSourceUploadObjectKey } from "./oss";
import {
  QUOTE_SOURCE_WORKBOOK_CONFIGS,
  createQuoteSourceDryRunSummaryFromMetadata,
  getQuoteSourceWorkbookConfig,
  matchQuoteSourceAdapter
} from "../quote-draft";
import type { QuoteSourceDryRunSummary, QuoteSourceWorkbookMetadata, QuoteSourceWorkbookMetadataFileType } from "../quote-draft";

const OSS = require("ali-oss") as new (options: {
  region: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
}) => {
  get: (name: string) => Promise<{ content: Buffer | string | Uint8Array }>;
};

const XLSX = require("xlsx") as typeof import("xlsx");

const DRY_RUN_SAFETY_NOTICE = [
  "uploaded quote source dry-run 只读取 OSS 私有文件结构，不导入价格。",
  "dry-run 不等于 FinanceApprovedPrice，不生成 staging rows、报价草稿或正式报价。",
  "报价表 / 成本表 / 价格候选数据由财务提交和维护，出口部不能上传或维护价格表。"
];

const DRY_RUN_FORBIDDEN_METADATA_KEYS = [
  "amount",
  "unitPrice",
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
  "databaseUrl",
  "directUrl",
  "excelRows",
  "kjRows",
  "oemRows"
];
const DRY_RUN_ALLOWED_SAFETY_KEYS = new Set([
  "hasCostCandidateColumn",
  "hasQuoteCandidateColumn",
  "writesStagingBatch",
  "writesStagingRows",
  "importsPrices",
  "savesKjRows",
  "savesOemRows",
  "generatesQuoteDraft",
  "generatesOfficialQuote"
]);

export type QuoteSourceUploadDryRunMetadata = {
  dryRunKind: "finance_quote_source_upload_structure_only";
  safetyNotice: string[];
  sourceFileName: string;
  fileType: QuoteSourceWorkbookMetadataFileType;
  sheetCount: number;
  workbookMetadata: QuoteSourceWorkbookMetadata;
  sheetSummaries: Array<{
    sheetName: string;
    usedRange: string | null;
    headerCandidates: string[];
  }>;
  adapterMatch: ReturnType<typeof matchQuoteSourceAdapter>;
  dryRunSummary: QuoteSourceDryRunSummary;
  fieldDetection: {
    hasKjColumn: boolean;
    hasOemOrOeColumn: boolean;
    hasProductNameColumn: boolean;
    hasCostCandidateColumn: boolean;
    hasQuoteCandidateColumn: boolean;
    hasPackagingColumn: boolean;
  };
  sideEffects: {
    readsOssObject: true;
    writesQuoteSourceUploadDryRunMetadata: true;
    writesAuditLog: true;
    writesStagingBatch: false;
    writesStagingRows: false;
    importsPrices: false;
    savesKjRows: false;
    savesOemRows: false;
    generatesQuoteDraft: false;
    generatesOfficialQuote: false;
  };
};

type RunQuoteSourceUploadDryRunOptions = {
  readObjectBuffer?: (upload: Pick<QuoteSourceUpload, "storageKey">) => Promise<Buffer>;
  now?: () => Date;
  db?: typeof prisma;
};

function getFileType(fileName: string): QuoteSourceWorkbookMetadataFileType {
  const normalized = fileName.normalize("NFKC").toLowerCase();
  if (normalized.endsWith(".xlsx")) return "xlsx";
  if (normalized.endsWith(".xls")) return "xls";
  return "unknown";
}

function normalizeHeaderCandidate(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function doesHeaderMatchCandidate(header: string, candidate: string) {
  const normalizedHeader = normalizeHeaderCandidate(header);
  const normalizedCandidate = normalizeHeaderCandidate(candidate);

  return (
    normalizedHeader === normalizedCandidate ||
    (normalizedCandidate.length >= 4 && normalizedHeader.includes(normalizedCandidate))
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getAllColumnHeaderCandidates(adapterId?: string) {
  const configs = adapterId
    ? [getQuoteSourceWorkbookConfig(adapterId)].filter((config): config is (typeof QUOTE_SOURCE_WORKBOOK_CONFIGS)[number] => Boolean(config))
    : QUOTE_SOURCE_WORKBOOK_CONFIGS;
  const candidates: string[] = [];

  for (const config of configs) {
    for (const sheet of [...config.primarySheets, ...(config.auxiliarySheets ?? [])]) {
      for (const values of Object.values(sheet.columnMapping)) {
        candidates.push(...(values ?? []));
      }
    }
  }

  return new Set(candidates.map(normalizeHeaderCandidate));
}

function getCellValue(sheet: import("xlsx").WorkSheet, rowIndex: number, columnIndex: number) {
  const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = sheet[cellAddress];
  return cell?.v;
}

function extractHeaderCandidatesFromSheet(
  sheet: import("xlsx").WorkSheet,
  maxRows: number,
  headerVocabulary: Set<string>
) {
  const rangeRef = sheet["!ref"];
  if (!rangeRef) return { usedRange: null, headerCandidates: [] };

  const range = XLSX.utils.decode_range(rangeRef);
  let bestHeaders: string[] = [];
  const lastRow = Math.min(range.e.r, range.s.r + maxRows - 1);
  const vocabulary = Array.from(headerVocabulary);

  for (let rowIndex = range.s.r; rowIndex <= lastRow; rowIndex += 1) {
    const rowHeaders: string[] = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const value = getCellValue(sheet, rowIndex, columnIndex);
      if (typeof value !== "string") continue;

      const normalized = normalizeHeaderCandidate(value);
      const isKnownHeader = vocabulary.some((candidate) => doesHeaderMatchCandidate(normalized, candidate));
      if (isKnownHeader) rowHeaders.push(String(value).normalize("NFKC").trim().slice(0, 80));
    }

    if (rowHeaders.length > bestHeaders.length) bestHeaders = rowHeaders;
  }

  return {
    usedRange: rangeRef,
    headerCandidates: unique(bestHeaders)
  };
}

function hasMappedColumn(summary: QuoteSourceDryRunSummary, keys: string[]) {
  return keys.some((key) => (summary.mappedColumns[key] ?? []).length > 0);
}

function assertNoForbiddenDryRunMetadataKeys(value: unknown) {
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
      const forbidden = DRY_RUN_FORBIDDEN_METADATA_KEYS.find((field) => normalizedKey.includes(field.toLowerCase()));
      if (forbidden && !DRY_RUN_ALLOWED_SAFETY_KEYS.has(key)) {
        throw new Error(`dry-run metadata cannot include forbidden field key: ${forbidden}`);
      }
      stack.push(nested);
    }
  }
}

export function createQuoteSourceUploadDryRunMetadataFromBuffer(
  sourceFileName: string,
  fileBuffer: Buffer,
  maxRows = 20
): QuoteSourceUploadDryRunMetadata {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    sheetRows: Math.max(1, Math.min(100, Math.floor(maxRows))),
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    bookVBA: false
  });
  const metadataWithoutHeaders: QuoteSourceWorkbookMetadata = {
    sourceFileName,
    fileType: getFileType(sourceFileName),
    detectedSheets: workbook.SheetNames
  };
  const adapterMatch = matchQuoteSourceAdapter(metadataWithoutHeaders);
  const headerVocabulary = getAllColumnHeaderCandidates(adapterMatch.adapterId);
  const detectedHeadersBySheet: Record<string, string[]> = {};
  const sheetSummaries: QuoteSourceUploadDryRunMetadata["sheetSummaries"] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const sheetSummary = extractHeaderCandidatesFromSheet(sheet, maxRows, headerVocabulary);
    detectedHeadersBySheet[sheetName] = sheetSummary.headerCandidates;
    sheetSummaries.push({ sheetName, ...sheetSummary });
  }

  const workbookMetadata = {
    ...metadataWithoutHeaders,
    detectedHeadersBySheet
  };
  const dryRunSummary = createQuoteSourceDryRunSummaryFromMetadata(workbookMetadata);
  const result: QuoteSourceUploadDryRunMetadata = {
    dryRunKind: "finance_quote_source_upload_structure_only",
    safetyNotice: DRY_RUN_SAFETY_NOTICE,
    sourceFileName,
    fileType: workbookMetadata.fileType,
    sheetCount: workbookMetadata.detectedSheets.length,
    workbookMetadata,
    sheetSummaries,
    adapterMatch,
    dryRunSummary,
    fieldDetection: {
      hasKjColumn: hasMappedColumn(dryRunSummary, ["kjCode", "oldCode", "erpCode", "fumacrmCode"]),
      hasOemOrOeColumn: hasMappedColumn(dryRunSummary, ["oemCode"]),
      hasProductNameColumn: hasMappedColumn(dryRunSummary, ["productName", "model"]),
      hasCostCandidateColumn: hasMappedColumn(dryRunSummary, ["costPrice"]),
      hasQuoteCandidateColumn: hasMappedColumn(dryRunSummary, ["quotePrice"]),
      hasPackagingColumn: hasMappedColumn(dryRunSummary, ["packaging"])
    },
    sideEffects: {
      readsOssObject: true,
      writesQuoteSourceUploadDryRunMetadata: true,
      writesAuditLog: true,
      writesStagingBatch: false,
      writesStagingRows: false,
      importsPrices: false,
      savesKjRows: false,
      savesOemRows: false,
      generatesQuoteDraft: false,
      generatesOfficialQuote: false
    }
  };
  assertNoForbiddenDryRunMetadataKeys({
    dryRunKind: result.dryRunKind,
    sideEffects: result.sideEffects
  });
  return result;
}

export function assertCanRunQuoteSourceUploadDryRun(actor: AuthUser) {
  if (actor.role !== "super_admin") {
    throw new Error("当前账号不能执行财务报价表结构识别 dry-run。");
  }
}

function getOssConnectionConfig() {
  const env = process.env;
  if (
    !env.ALIYUN_OSS_REGION ||
    !env.ALIYUN_OSS_BUCKET ||
    !env.ALIYUN_OSS_ENDPOINT ||
    !env.ALIYUN_OSS_ACCESS_KEY_ID ||
    !env.ALIYUN_OSS_ACCESS_KEY_SECRET
  ) {
    throw new Error("OSS 尚未配置，暂时不能执行报价表 dry-run。");
  }
  return {
    region: env.ALIYUN_OSS_REGION,
    bucket: env.ALIYUN_OSS_BUCKET,
    endpoint: env.ALIYUN_OSS_ENDPOINT,
    accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET
  };
}

export async function readQuoteSourceUploadObjectBuffer(upload: Pick<QuoteSourceUpload, "storageKey">) {
  const storageKey = assertQuoteSourceUploadObjectKey(upload.storageKey);
  const client = new OSS(getOssConnectionConfig());
  const response = await client.get(storageKey);
  if (Buffer.isBuffer(response.content)) return response.content;
  return Buffer.from(response.content);
}

export async function runQuoteSourceUploadDryRun(
  actor: AuthUser,
  uploadId: string,
  options: RunQuoteSourceUploadDryRunOptions = {}
) {
  assertCanRunQuoteSourceUploadDryRun(actor);
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  const upload = await db.quoteSourceUpload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error("报价表上传记录不存在。");
  if (upload.uploadStatus !== "uploaded") throw new Error("只有 uploaded 状态的报价表文件可以执行 dry-run。");

  const readObjectBuffer = options.readObjectBuffer ?? readQuoteSourceUploadObjectBuffer;
  const fileBuffer = await readObjectBuffer(upload);
  const dryRun = createQuoteSourceUploadDryRunMetadataFromBuffer(upload.sourceFileName, fileBuffer);
  const warnings = unique([...dryRun.dryRunSummary.warnings, ...dryRun.dryRunSummary.unsupportedReasons]);
  const dryRunStatus = dryRun.adapterMatch.matchedAdapter && dryRun.adapterMatch.unsupportedReasons.length === 0 ? "completed" : "needs_review";
  const dryRunAt = now();
  const mappedColumnKeys = Object.keys(dryRun.dryRunSummary.mappedColumns);

  const updated = await db.$transaction(async (tx) => {
    const uploadRecord = await tx.quoteSourceUpload.update({
      where: { id: upload.id },
      data: {
        dryRunStatus,
        dryRunAdapterId: dryRun.adapterMatch.adapterId ?? dryRun.dryRunSummary.adapterId,
        dryRunCategory: dryRun.adapterMatch.category ?? null,
        dryRunSummary: dryRun,
        dryRunWarnings: warnings,
        dryRunAt,
        dryRunByUserId: actor.id,
        dryRunByName: actor.name
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "quote_source_upload.dry_run",
        entityType: "QuoteSourceUpload",
        entityId: upload.id,
        metadata: {
          uploadId: upload.id,
          sourceFileName: upload.sourceFileName,
          adapterId: dryRun.adapterMatch.adapterId ?? dryRun.dryRunSummary.adapterId,
          category: dryRun.adapterMatch.category,
          dryRunStatus,
          sheetCount: dryRun.sheetCount,
          mappedColumnKeys,
          warnings,
          actorUserId: actor.id,
          actorName: actor.name
        }
      }
    });
    return uploadRecord;
  });

  return { upload: updated, dryRun };
}
