import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { prisma } from "@/lib/honoa/server/db";
import { confirmQuoteSourceStagingBatchForDraftCandidates } from "./source-staging-confirmation";
import type {
  ConfirmQuoteSourceStagingBatchActionInput,
  ConfirmQuoteSourceStagingBatchActionResult,
  QuoteSourceStagingConfirmationActionAuditMetadata
} from "./source-staging-confirmation-contract";

const FINANCE_STAGING_CONFIRM_AUDIT_ACTION = "quote_source_staging.finance_confirmed";

const SENSITIVE_ACTION_FIELDS = [
  "amount",
  "costPrice",
  "quotePrice",
  "unitPrice",
  "salesPrice",
  "approvedPrice",
  "financeApprovedPrice",
  "minimumPrice",
  "grossMargin",
  "margin",
  "profit",
  "officialQuote",
  "sentToCustomer"
];

function assertNoSensitiveActionFields(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of SENSITIVE_ACTION_FIELDS) {
    if (serialized.includes(field)) {
      throw new Error("quote source staging confirmation action cannot include sensitive price fields");
    }
  }
}

function normalizeRowVisibilityPolicy(input: ConfirmQuoteSourceStagingBatchActionInput) {
  const policy = input.rowVisibilityPolicy ?? "strict_candidate_only";
  if (policy !== "strict_candidate_only") {
    throw new Error("quote source staging confirmation only supports strict_candidate_only");
  }
  return policy;
}

export async function confirmQuoteSourceStagingBatchAction(
  input: ConfirmQuoteSourceStagingBatchActionInput
): Promise<ConfirmQuoteSourceStagingBatchActionResult> {
  "use server";

  const actor = await requireCurrentUser();
  if (actor.role !== "super_admin") {
    throw new Error("当前账号不能确认 Finance 报价表 staging。");
  }

  const rowVisibilityPolicy = normalizeRowVisibilityPolicy(input);
  const result = await confirmQuoteSourceStagingBatchForDraftCandidates(
    prisma,
    {
      batchId: input.batchId,
      actorUserId: actor.id,
      actorName: actor.name,
      confirmationNote: input.confirmationNote,
      rowVisibilityPolicy
    },
    { databaseUrl: process.env.DATABASE_URL }
  );

  const metadata: QuoteSourceStagingConfirmationActionAuditMetadata = {
    ...result.auditMetadata,
    confirmationNote: input.confirmationNote,
    rowVisibilityPolicy
  };
  assertNoSensitiveActionFields(metadata);

  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: FINANCE_STAGING_CONFIRM_AUDIT_ACTION,
      entityType: "QuoteSourceStagingBatch",
      entityId: result.batchId,
      metadata
    }
  });

  const actionResult: ConfirmQuoteSourceStagingBatchActionResult = {
    ok: true,
    batchId: result.batchId,
    previousStatus: result.previousStatus,
    nextStatus: result.nextStatus,
    exportDraftCandidateRows: result.exportDraftCandidateRows,
    financeOnlyRows: result.financeOnlyRows,
    internalRiskOnlyRows: result.internalRiskOnlyRows,
    warnings: result.warnings
  };
  assertNoSensitiveActionFields(actionResult);

  return actionResult;
}
