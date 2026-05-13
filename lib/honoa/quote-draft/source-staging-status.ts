import type { QuoteSourceStagingBatchStatus } from "./source-staging-types";

export const QUOTE_SOURCE_STAGING_BATCH_TRANSITIONS: Record<
  QuoteSourceStagingBatchStatus,
  QuoteSourceStagingBatchStatus[]
> = {
  draft: ["dry_run_passed"],
  dry_run_passed: [
    "finance_confirmed",
    "adapter_fix_required",
    "finance_table_fix_required",
    "cancelled"
  ],
  adapter_fix_required: ["dry_run_passed"],
  finance_table_fix_required: ["dry_run_passed"],
  finance_confirmed: ["cancelled"],
  cancelled: []
};

export type QuoteSourceStagingAuditMetadata = {
  batchId: string;
  sourceFileName?: string;
  adapterId?: string;
  category?: string;
  previousStatus: string;
  nextStatus: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
};

export function canTransitionQuoteSourceStagingBatch(
  currentStatus: QuoteSourceStagingBatchStatus,
  nextStatus: QuoteSourceStagingBatchStatus
): boolean {
  return QUOTE_SOURCE_STAGING_BATCH_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export function assertQuoteSourceStagingBatchTransition(
  currentStatus: QuoteSourceStagingBatchStatus,
  nextStatus: QuoteSourceStagingBatchStatus
): void {
  if (!canTransitionQuoteSourceStagingBatch(currentStatus, nextStatus)) {
    throw new Error(
      `Invalid quote source staging status transition: ${currentStatus} -> ${nextStatus}`
    );
  }
}
