import { QUOTE_SOURCE_WORKBOOK_CONFIGS, getQuoteSourceWorkbookConfig } from "./source-adapters";
import type {
  QuoteColumnMapping,
  QuoteSourceAdapterMatchConfidence,
  QuoteSourceAdapterMatchResult,
  QuoteSourceDryRunSummary,
  QuoteSourceSheetConfig,
  QuoteSourceWorkbookConfig,
  QuoteSourceWorkbookMetadata
} from "./source-adapter-types";

const FINANCE_SOURCE_WARNING = "报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。";
const PRICE_BOUNDARY_WARNING = "成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。";
const EXPORT_CONSUMER_WARNING = "Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。";
const NO_AUTO_APPROVAL_WARNING = "dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。";

const CRITICAL_COLUMN_WARNING_BY_FIELD: Record<string, string> = {
  kjCode: "缺少 KJ 编号列候选。",
  productName: "缺少产品名称列候选。",
  costPrice: "缺少成本候选列。"
};

function normalizeComparableText(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getAllSheetConfigs(config: QuoteSourceWorkbookConfig): QuoteSourceSheetConfig[] {
  return [...config.primarySheets, ...(config.auxiliarySheets ?? [])];
}

function getMatchingSheetConfigs(config: QuoteSourceWorkbookConfig, sheetName: string): QuoteSourceSheetConfig[] {
  const normalizedSheetName = normalizeComparableText(sheetName);
  const matched = getAllSheetConfigs(config).filter((sheetConfig) => {
    if (!sheetConfig.sheetNameHint) {
      return false;
    }

    return normalizeComparableText(sheetConfig.sheetNameHint) === normalizedSheetName;
  });

  return matched.length > 0 ? matched : config.primarySheets;
}

function matchesFileNamePattern(config: QuoteSourceWorkbookConfig, sourceFileName: string) {
  try {
    return new RegExp(config.fileNamePattern, "i").test(sourceFileName.normalize("NFKC"));
  } catch {
    return false;
  }
}

function matchesAnySheetHint(config: QuoteSourceWorkbookConfig, detectedSheets: string[]) {
  const normalizedDetectedSheets = new Set(detectedSheets.map(normalizeComparableText));

  return getAllSheetConfigs(config).some((sheetConfig) => {
    if (!sheetConfig.sheetNameHint) {
      return false;
    }

    return normalizedDetectedSheets.has(normalizeComparableText(sheetConfig.sheetNameHint));
  });
}

function confidenceRank(confidence: QuoteSourceAdapterMatchConfidence) {
  switch (confidence) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "none":
      return 0;
  }
}

function getBaseWarnings(config?: QuoteSourceWorkbookConfig) {
  const sheetRiskNotes = config
    ? getAllSheetConfigs(config).flatMap((sheetConfig) => sheetConfig.riskNotes ?? [])
    : [];

  return unique([
    PRICE_BOUNDARY_WARNING,
    FINANCE_SOURCE_WARNING,
    EXPORT_CONSUMER_WARNING,
    NO_AUTO_APPROVAL_WARNING,
    "Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。",
    "OEM / OE 可能一对多，本阶段不做自动匹配。",
    ...sheetRiskNotes
  ]);
}

function getFileTypeUnsupportedReasons(config: QuoteSourceWorkbookConfig, metadata: QuoteSourceWorkbookMetadata) {
  if (metadata.fileType === "unknown") {
    return ["文件类型未知，无法确认是否为支持的 xls / xlsx。"];
  }

  if (!config.supportedFileTypes.includes(metadata.fileType)) {
    return [`文件类型 ${metadata.fileType} 不在该 adapter 支持范围内。`];
  }

  return [];
}

export function matchQuoteSourceAdapter(metadata: QuoteSourceWorkbookMetadata): QuoteSourceAdapterMatchResult {
  const candidates = QUOTE_SOURCE_WORKBOOK_CONFIGS.map((config) => {
    const fileNameMatched = matchesFileNamePattern(config, metadata.sourceFileName);
    const sheetMatched = matchesAnySheetHint(config, metadata.detectedSheets);

    let confidence: QuoteSourceAdapterMatchConfidence = "none";
    if (fileNameMatched && sheetMatched) {
      confidence = "high";
    } else if (fileNameMatched) {
      confidence = "medium";
    } else if (sheetMatched) {
      confidence = "low";
    }

    const matchedReasons = [
      fileNameMatched ? "文件名命中 adapter fileNamePattern。" : "",
      sheetMatched ? "sheet 名称命中 adapter sheetNameHint。" : ""
    ].filter(Boolean);

    return { config, confidence, matchedReasons };
  }).sort((left, right) => confidenceRank(right.confidence) - confidenceRank(left.confidence));

  const bestCandidate = candidates[0];
  if (!bestCandidate || bestCandidate.confidence === "none") {
    return {
      matchedAdapter: false,
      confidence: "none",
      matchedReasons: [],
      warnings: getBaseWarnings(),
      unsupportedReasons: ["未匹配到报价表 adapter。"]
    };
  }

  const unsupportedReasons = getFileTypeUnsupportedReasons(bestCandidate.config, metadata);

  return {
    matchedAdapter: true,
    adapterId: bestCandidate.config.id,
    category: bestCandidate.config.category,
    confidence: bestCandidate.confidence,
    submittedByRole: "finance",
    consumerDepartment: "export",
    matchedReasons: bestCandidate.matchedReasons,
    warnings: getBaseWarnings(bestCandidate.config),
    unsupportedReasons
  };
}

function mapColumnsForHeaders(columnMapping: QuoteColumnMapping, headers: string[]) {
  const normalizedHeaderByRaw = new Map(headers.map((header) => [normalizeComparableText(header), header]));
  const mappedColumns: Record<string, string[]> = {};

  for (const [fieldKey, candidates] of Object.entries(columnMapping)) {
    const matchedHeaders = (candidates ?? [])
      .map((candidate) => normalizedHeaderByRaw.get(normalizeComparableText(candidate)))
      .filter((header): header is string => Boolean(header));

    if (matchedHeaders.length > 0) {
      mappedColumns[fieldKey] = unique([...(mappedColumns[fieldKey] ?? []), ...matchedHeaders]);
    }
  }

  return mappedColumns;
}

function mergeMappedColumns(target: Record<string, string[]>, source: Record<string, string[]>) {
  for (const [fieldKey, headers] of Object.entries(source)) {
    target[fieldKey] = unique([...(target[fieldKey] ?? []), ...headers]);
  }
}

function getDetectedHeaderRows(config: QuoteSourceWorkbookConfig | null, detectedSheets: string[]) {
  const rows: Record<string, number | null> = {};

  for (const sheetName of detectedSheets) {
    const sheetConfig = config
      ? getAllSheetConfigs(config).find((candidate) => {
          if (!candidate.sheetNameHint) {
            return false;
          }

          return normalizeComparableText(candidate.sheetNameHint) === normalizeComparableText(sheetName);
        })
      : null;

    rows[sheetName] = typeof sheetConfig?.headerRowHint === "number" ? sheetConfig.headerRowHint : null;
  }

  return rows;
}

function getMappedColumns(config: QuoteSourceWorkbookConfig | null, metadata: QuoteSourceWorkbookMetadata) {
  if (!config || !metadata.detectedHeadersBySheet) {
    return {};
  }

  const mappedColumns: Record<string, string[]> = {};

  for (const [sheetName, headers] of Object.entries(metadata.detectedHeadersBySheet)) {
    const matchingSheetConfigs = getMatchingSheetConfigs(config, sheetName);

    for (const sheetConfig of matchingSheetConfigs) {
      mergeMappedColumns(mappedColumns, mapColumnsForHeaders(sheetConfig.columnMapping, headers));
    }
  }

  return mappedColumns;
}

function getMissingColumnWarnings(mappedColumns: Record<string, string[]>) {
  const warnings: string[] = [];

  if (!mappedColumns.kjCode && !mappedColumns.oldCode && !mappedColumns.erpCode && !mappedColumns.fumacrmCode) {
    warnings.push(CRITICAL_COLUMN_WARNING_BY_FIELD.kjCode);
  }

  if (!mappedColumns.productName && !mappedColumns.model) {
    warnings.push(CRITICAL_COLUMN_WARNING_BY_FIELD.productName);
  }

  if (!mappedColumns.costPrice && !mappedColumns.quotePrice) {
    warnings.push(CRITICAL_COLUMN_WARNING_BY_FIELD.costPrice);
  }

  return warnings;
}

export function createQuoteSourceDryRunSummaryFromMetadata(
  metadata: QuoteSourceWorkbookMetadata
): QuoteSourceDryRunSummary {
  const matchResult = matchQuoteSourceAdapter(metadata);
  const matchedConfig = matchResult.adapterId ? getQuoteSourceWorkbookConfig(matchResult.adapterId) : null;
  const mappedColumns = getMappedColumns(matchedConfig, metadata);

  return {
    sourceFileName: metadata.sourceFileName,
    adapterId: matchResult.adapterId ?? "unmatched",
    submittedByRole: "finance",
    consumerDepartment: "export",
    matchedAdapter: matchResult.matchedAdapter,
    detectedSheets: metadata.detectedSheets,
    detectedHeaderRows: getDetectedHeaderRows(matchedConfig, metadata.detectedSheets),
    mappedColumns,
    warnings: unique([...matchResult.warnings, ...getMissingColumnWarnings(mappedColumns)]),
    unsupportedReasons: matchResult.unsupportedReasons
  };
}
