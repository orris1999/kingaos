import type {
  QuoteSourceStagingBatchStatus,
  QuoteSourceStagingPriceCandidateStatus,
  QuoteSourceStagingRowStatus,
  QuoteSourceStagingTradeMode,
  QuoteSourceStagingVisibility
} from "./source-staging-types";
import type { QuoteSourceDryRunDecisionStatus } from "./source-dry-run-decision";

export type CreateQuoteSourceStagingBatchInput = {
  sourceFileName: string;
  adapterId: string;
  category?: string;
  submittedByRole?: "finance";
  consumerDepartment?: "export";
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus;
  status?: QuoteSourceStagingBatchStatus;
  createdByUserId?: string;
  createdByName?: string;
  confirmedByUserId?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  warnings?: string[];
  notes?: string;
};

export type CreateQuoteSourceStagingRowInput = {
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
  warnings?: string[];
};

export type QuoteSourceStagingBatchFilter = {
  status?: QuoteSourceStagingBatchStatus;
  adapterId?: string;
  category?: string;
};

export type QuoteSourceStagingRowFilter = {
  rowStatus?: QuoteSourceStagingRowStatus;
  visibility?: QuoteSourceStagingVisibility;
};

export type QuoteSourceStagingStatusActor = {
  userId?: string;
  name?: string;
  reason?: string;
  notes?: string;
  warnings?: string[];
};

export type QuoteSourceStagingRepositoryOptions = {
  databaseUrl?: string;
};
