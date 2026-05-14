import * as XLSX from "xlsx";
import { getQuoteSourceWorkbookConfig } from "./source-adapters";
import type { QuoteColumnMapping, QuoteSourceSheetConfig } from "./source-adapter-types";
import type { QuoteSourceWorkbookRowLike } from "./source-staging-row-import-mapper";

export type ParseQuoteSourceWorkbookRowsInput = {
  sourceFileName: string;
  fileBuffer: Buffer;
  adapterId: string;
  maxRows?: number;
};

const SUPPORTED_ADAPTER_ID = "condenser-cost-2026";

const EXTRA_PRICE_HEADER_ALIASES = [
  "出口成本",
  "出口成本价",
  "出口成本报价",
  "出口部内销成本",
  "出口部内销成本价",
  "出口部内销成本报价",
  "报价",
  "报价候选",
  "单价"
];

function normalizeHeader(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.normalize("NFKC").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).normalize("NFKC").trim();
  if (value instanceof Date) return value.toISOString();
  return "";
}

function hasValue(value: unknown) {
  return normalizeCellValue(value).length > 0;
}

function getPrimarySheetConfig(adapterId: string) {
  const config = getQuoteSourceWorkbookConfig(adapterId);
  if (!config || adapterId !== SUPPORTED_ADAPTER_ID) {
    throw new Error("009H row import parser first version only supports condenser-cost-2026 / 冷凝器。");
  }

  const sheetConfig = config.primarySheets[0];
  if (!sheetConfig) {
    throw new Error("quote source row import parser requires a primary sheet config");
  }

  return sheetConfig;
}

function pickSheetName(workbook: XLSX.WorkBook, sheetConfig: QuoteSourceSheetConfig) {
  const hintedSheetName = sheetConfig.sheetNameHint
    ? workbook.SheetNames.find((name) => name.includes(sheetConfig.sheetNameHint ?? ""))
    : undefined;

  return hintedSheetName ?? workbook.SheetNames[0];
}

function getPriceHeaderAliases(mapping: QuoteColumnMapping) {
  return [
    ...(mapping.costPrice ?? []),
    ...(mapping.quotePrice ?? []),
    ...EXTRA_PRICE_HEADER_ALIASES
  ].map(normalizeHeader);
}

function isSensitivePriceHeader(header: string, normalizedPriceAliases: string[]) {
  const normalizedHeader = normalizeHeader(header);
  return normalizedPriceAliases.some(
    (alias) => normalizedHeader === alias || normalizedHeader.includes(alias)
  );
}

function sanitizeCellForHeader(header: string, value: unknown, normalizedPriceAliases: string[]) {
  if (!isSensitivePriceHeader(header, normalizedPriceAliases)) {
    return normalizeCellValue(value);
  }

  return hasValue(value) ? true : "";
}

export function parseQuoteSourceWorkbookRowsFromBuffer(
  input: ParseQuoteSourceWorkbookRowsInput
): QuoteSourceWorkbookRowLike[] {
  const sheetConfig = getPrimarySheetConfig(input.adapterId);
  const workbook = XLSX.read(input.fileBuffer, { type: "buffer", cellDates: true });
  const sheetName = pickSheetName(workbook, sheetConfig);
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.["!ref"]) return [];

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const headerRowIndex = typeof sheetConfig.headerRowHint === "number"
    ? sheetConfig.headerRowHint - 1
    : range.s.r;
  const dataStartRowIndex = typeof sheetConfig.dataStartRowHint === "number"
    ? sheetConfig.dataStartRowHint - 1
    : headerRowIndex + 1;
  const headers: Array<{ columnIndex: number; label: string }> = [];

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex })];
    const label = normalizeCellValue(cell?.v);
    if (label) headers.push({ columnIndex, label });
  }

  const normalizedPriceAliases = getPriceHeaderAliases(sheetConfig.columnMapping);
  const rows: QuoteSourceWorkbookRowLike[] = [];
  const maxRows = input.maxRows ?? Number.POSITIVE_INFINITY;

  for (let rowIndex = dataStartRowIndex; rowIndex <= range.e.r && rows.length < maxRows; rowIndex += 1) {
    const columns: Record<string, unknown> = {};

    for (const header of headers) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: header.columnIndex })];
      const sanitizedValue = sanitizeCellForHeader(header.label, cell?.v, normalizedPriceAliases);
      if (sanitizedValue !== "") {
        columns[header.label] = sanitizedValue;
      }
    }

    if (Object.keys(columns).length > 0) {
      rows.push({
        sourceRowNumber: rowIndex + 1,
        columns
      });
    }
  }

  return rows;
}
