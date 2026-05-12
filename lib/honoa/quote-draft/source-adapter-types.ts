export type QuoteSourceFileType = "xls" | "xlsx";

export type QuoteSourceSubmitterRole = "finance";

export type QuoteSourceConsumerDepartment = "export";

export type QuoteSourceSheetRole =
  | "primary_cost_table"
  | "oem_mapping"
  | "packaging"
  | "notes"
  | "unknown";

export type QuoteSourceImageStrategy = "none" | "embedded_excel_image" | "url_column" | "unknown";

export type QuoteSourcePriceFieldStrategy = "cost_candidate" | "quote_candidate" | "unknown";

export type QuoteColumnMapping = {
  kjCode?: string[];
  oldCode?: string[];
  erpCode?: string[];
  fumacrmCode?: string[];
  oemCode?: string[];
  productName?: string[];
  model?: string[];
  specification?: string[];
  category?: string[];
  costPrice?: string[];
  quotePrice?: string[];
  currency?: string[];
  packaging?: string[];
  unit?: string[];
  moq?: string[];
  notes?: string[];
};

export type QuoteSourceSheetConfig = {
  sheetRole: QuoteSourceSheetRole;
  sheetNameHint?: string;
  headerRowHint?: number | "detect";
  dataStartRowHint?: number | "detect";
  columnMapping: QuoteColumnMapping;
  imageStrategy: QuoteSourceImageStrategy;
  priceFieldStrategy: QuoteSourcePriceFieldStrategy;
  riskNotes?: string[];
};

export type QuoteSourceWorkbookConfig = {
  id: string;
  category: string;
  fileNamePattern: string;
  supportedFileTypes: QuoteSourceFileType[];
  submittedByRole: QuoteSourceSubmitterRole;
  consumerDepartment: QuoteSourceConsumerDepartment;
  primarySheets: QuoteSourceSheetConfig[];
  auxiliarySheets?: QuoteSourceSheetConfig[];
  notes?: string[];
};

export type QuoteSourceDryRunSummary = {
  sourceFileName: string;
  adapterId: string;
  submittedByRole: QuoteSourceSubmitterRole;
  consumerDepartment: QuoteSourceConsumerDepartment;
  matchedAdapter: boolean;
  detectedSheets: string[];
  detectedHeaderRows: Record<string, number | null>;
  mappedColumns: Record<string, string[]>;
  rowCountEstimate?: number;
  warnings: string[];
  unsupportedReasons: string[];
};

export function createQuoteSourceDryRunSummarySkeleton(
  config: QuoteSourceWorkbookConfig,
  sourceFileName: string
): QuoteSourceDryRunSummary {
  return {
    sourceFileName,
    adapterId: config.id,
    submittedByRole: "finance",
    consumerDepartment: "export",
    matchedAdapter: false,
    detectedSheets: [],
    detectedHeaderRows: {},
    mappedColumns: {},
    warnings: [
      "dry-run 只做结构识别，不写生产数据库，不导入真实价格，也不生成正式报价。",
      "报价表 / 成本表 / 价格候选数据必须由财务提交和维护。"
    ],
    unsupportedReasons: []
  };
}
