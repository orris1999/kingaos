import type {
  QuoteCandidateAmountCurrency,
  QuoteCandidateAmountSource,
  QuoteCandidateAmountStatus,
  QuoteCandidateAmountTradeMode,
  QuoteCandidateAmountVisibility
} from "./candidate-amount-types";

export type QuoteCandidateAmountStorageRecord = {
  id: string;
  stagingBatchId: string;
  stagingRowId: string;
  sourceUploadId?: string;
  sourceColumnName?: string;
  sourceColumnDate?: string;
  tradeMode: QuoteCandidateAmountTradeMode;
  currency: QuoteCandidateAmountCurrency;
  candidateValue: string;
  source: QuoteCandidateAmountSource;
  status: QuoteCandidateAmountStatus;
  visibility: QuoteCandidateAmountVisibility;
  isFinanceApprovedPrice: false;
  canBeSentToCustomer: false;
  requiresFinancePricing: true;
  importedByUserId?: string;
  importedByName?: string;
  importedAt: string;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateQuoteCandidateAmountInput = {
  stagingBatchId: string;
  stagingRowId: string;
  sourceUploadId?: string;
  sourceColumnName?: string;
  sourceColumnDate?: string;
  tradeMode: QuoteCandidateAmountTradeMode;
  currency: QuoteCandidateAmountCurrency;
  candidateValue: string;
  source?: QuoteCandidateAmountSource;
  status?: QuoteCandidateAmountStatus;
  visibility?: QuoteCandidateAmountVisibility;
  importedByUserId?: string;
  importedByName?: string;
  warnings?: string[];
};

export type QuoteCandidateAmountSourceKey = {
  stagingRowId: string;
  tradeMode: QuoteCandidateAmountTradeMode;
  sourceColumnName: string;
  sourceColumnDate: string;
};

export type QuoteCandidateAmountRepositoryOptions = {
  databaseUrl?: string;
};

export type QuoteCandidateAmountStorageBoundary = {
  isFinanceApprovedPrice: false;
  canBeSentToCustomer: false;
  requiresFinancePricing: true;
};
