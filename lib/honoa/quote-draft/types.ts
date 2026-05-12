export type SourceCodeType = "standard_kj" | "old_code" | "erp_code" | "fumacrm_code" | "unknown_code";

export type QuoteDraftRequestedCodeType = "kj" | "oem" | "oe" | "customer_part_no" | "unknown";

export type QuoteDraftMatchStatus =
  | "matched_by_kj"
  | "kj_not_found"
  | "ambiguous_kj"
  | "matched_by_oem_candidate"
  | "oem_not_supported_yet"
  | "requires_technical_review";

export type QuoteDraftImageStatus = "available" | "missing" | "embedded_only" | "not_supported_yet";

export type QuoteDraftPriceStatus =
  | "candidate_cost_available"
  | "candidate_quote_available"
  | "missing"
  | "expired"
  | "requires_finance_review"
  | "not_finance_approved";

export type QuoteDraftPriceSourceType = "cost_candidate" | "quote_candidate" | "unknown";

export type NormalizedKjCode = {
  rawKjCode: string;
  standardKjCode: string;
  sourceCodeType: SourceCodeType;
  warnings: string[];
};

export type QuoteDraftInputLine = {
  rawInput: string;
  requestedCode: string;
  requestedCodeType: QuoteDraftRequestedCodeType;
  quantity?: number;
  customerNote?: string;
  warnings: string[];
};

export type QuoteDraftPriceCandidate = {
  amount?: number;
  currency?: string;
  sourceFile?: string;
  sourceSheet?: string;
  sourceRow?: number;
  sourceType: QuoteDraftPriceSourceType;
};

export type QuoteDraftCatalogItem = {
  kjCode: string;
  rawKjCode?: string;
  sourceCodeType?: SourceCodeType;
  productName?: string;
  category?: string;
  oemCodes?: string[];
  imageStatus?: QuoteDraftImageStatus;
  imageRef?: string;
  unit?: string;
  priceCandidate?: QuoteDraftPriceCandidate;
  warnings?: string[];
};

export type QuoteDraftLineCandidate = {
  lineNo: number;
  rawInput: string;
  matchStatus: QuoteDraftMatchStatus;
  kjCode?: string;
  rawKjCode?: string;
  sourceCodeType?: SourceCodeType;
  productName?: string;
  category?: string;
  oemCodes?: string[];
  imageStatus: QuoteDraftImageStatus;
  imageRef?: string;
  quantity?: number;
  unit?: string;
  priceStatus: QuoteDraftPriceStatus;
  priceCandidate?: QuoteDraftPriceCandidate;
  warnings: string[];
};
