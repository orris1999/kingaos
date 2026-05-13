export const QUOTE_SOURCE_STAGING_CONFIRMATION_ROUTES = {
  list: "/finance/quote-source-staging",
  detailPattern: "/finance/quote-source-staging/[batchId]"
} as const;

export const QUOTE_SOURCE_STAGING_CONFIRMATION_PERMISSION_KEYS = [
  "finance.quote_source_staging.view",
  "finance.quote_source_staging.confirm",
  "finance.quote_source_staging.cancel",
  "finance.quote_source_staging.request_fix"
] as const;

export const QUOTE_SOURCE_STAGING_CONFIRMATION_ROW_VISIBILITY_POLICIES = [
  "strict_candidate_only"
] as const;

export const QUOTE_SOURCE_STAGING_CONFIRMATION_AUDIT_ACTIONS = [
  "quote_source_staging.finance_confirmed",
  "quote_source_staging.confirm",
  "quote_source_staging.request_adapter_fix",
  "quote_source_staging.request_finance_table_fix",
  "quote_source_staging.cancel"
] as const;

export type QuoteSourceStagingConfirmationPermissionKey =
  (typeof QUOTE_SOURCE_STAGING_CONFIRMATION_PERMISSION_KEYS)[number];

export type QuoteSourceStagingConfirmationRowVisibilityPolicy =
  (typeof QUOTE_SOURCE_STAGING_CONFIRMATION_ROW_VISIBILITY_POLICIES)[number];

export type QuoteSourceStagingConfirmationAuditAction =
  (typeof QUOTE_SOURCE_STAGING_CONFIRMATION_AUDIT_ACTIONS)[number];

export type ConfirmQuoteSourceStagingBatchActionInput = {
  batchId: string;
  confirmationNote?: string;
  rowVisibilityPolicy?: QuoteSourceStagingConfirmationRowVisibilityPolicy;
};

export type ConfirmQuoteSourceStagingBatchActionResult = {
  ok: boolean;
  batchId: string;
  previousStatus: string;
  nextStatus: "finance_confirmed";
  exportDraftCandidateRows: number;
  financeOnlyRows: number;
  internalRiskOnlyRows: number;
  warnings: string[];
  errors?: string[];
};

export type RequestQuoteSourceStagingFixActionInput = {
  batchId: string;
  reason: string;
  fixType: "adapter_fix_required" | "finance_table_fix_required";
};

export type RequestQuoteSourceStagingFixActionResult = {
  ok: boolean;
  batchId: string;
  previousStatus: string;
  nextStatus: "adapter_fix_required" | "finance_table_fix_required";
  warnings: string[];
  errors?: string[];
};

export type CancelQuoteSourceStagingBatchActionInput = {
  batchId: string;
  reason: string;
};

export type CancelQuoteSourceStagingBatchActionResult = {
  ok: boolean;
  batchId: string;
  previousStatus: string;
  nextStatus: "cancelled";
  warnings: string[];
  errors?: string[];
};

export type QuoteSourceStagingConfirmationActionAuditMetadata = {
  batchId: string;
  sourceFileName?: string;
  adapterId?: string;
  category?: string;
  previousStatus: string;
  nextStatus: string;
  actorUserId: string;
  actorName?: string;
  confirmationNote?: string;
  rowVisibilityPolicy: "strict_candidate_only";
  exportDraftCandidateRows: number;
  financeOnlyRows: number;
  internalRiskOnlyRows: number;
  addonOnlyRows: number;
  blockedRows: number;
  ignoredRows: number;
};
