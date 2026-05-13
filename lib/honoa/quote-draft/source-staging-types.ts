import type { QuoteSourceDryRunDecisionStatus } from "./source-dry-run-decision";

export type QuoteSourceStagingBatchStatus =
  | "draft"
  | "dry_run_passed"
  | "finance_confirmed"
  | "adapter_fix_required"
  | "finance_table_fix_required"
  | "cancelled";

export type QuoteSourceStagingRowStatus =
  | "candidate"
  | "needs_manual_review"
  | "addon_only"
  | "blocked"
  | "ignored";

export type QuoteSourceStagingVisibility =
  | "finance_only"
  | "export_draft_candidate"
  | "internal_risk_only";

export type QuoteSourceStagingPriceCandidateStatus =
  | "cost_candidate_available"
  | "quote_candidate_available"
  | "missing"
  | "not_finance_approved"
  | "requires_finance_review";

export type QuoteSourceStagingTradeMode = "export_usd" | "domestic_cny" | "unknown";

export type QuoteSourceStagingBatch = {
  id: string;
  sourceFileName: string;
  adapterId: string;
  category: string;
  submittedByRole: "finance";
  consumerDepartment: "export";
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus;
  status: QuoteSourceStagingBatchStatus;
  createdByUserId?: string;
  createdAt: string;
  confirmedByUserId?: string;
  confirmedAt?: string;
  warnings: string[];
  notes?: string;
};

export type QuoteSourceStagingRow = {
  id: string;
  batchId: string;
  sourceRowNumber?: number;

  rawKjCode?: string;
  standardKjCode?: string;
  baseKjCode?: string;
  oldKjNo?: string;
  fumacrmCode?: string;
  dingjieCodeWithoutCap?: string;
  dingjieCodeWithCap?: string;

  productNameCandidate?: string;
  category?: string;
  modelCandidate?: string;
  specificationCandidate?: string;

  tradeMode?: QuoteSourceStagingTradeMode;
  priceCandidateStatus: QuoteSourceStagingPriceCandidateStatus;

  hasCostCandidate: boolean;
  hasQuoteCandidate: boolean;
  hasPackagingInfo: boolean;
  hasOemInfo: boolean;

  visibility: QuoteSourceStagingVisibility;
  rowStatus: QuoteSourceStagingRowStatus;

  warnings: string[];
};
