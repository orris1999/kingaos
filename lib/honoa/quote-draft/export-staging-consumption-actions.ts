import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { prisma } from "@/lib/honoa/server/db";
import { isExportStagingQuoteDraftEnabled } from "@/lib/honoa/server/feature-flags";
import { findExportQuoteDraftSourceCandidates } from "./export-staging-consumption-repository";
import type {
  ExportQuoteDraftSourceCandidate,
  FindExportQuoteDraftSourceCandidatesInput
} from "./export-staging-consumption-types";

const SENSITIVE_EXPORT_STAGING_CANDIDATE_FIELDS = [
  "amount",
  "unitPrice",
  "costPrice",
  "quotePrice",
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

function assertNoSensitiveExportStagingCandidateFields(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of SENSITIVE_EXPORT_STAGING_CANDIDATE_FIELDS) {
    if (serialized.includes(field)) {
      throw new Error("export quote draft staging candidates cannot include sensitive price fields");
    }
  }
}

export async function findExportQuoteDraftSourceCandidatesAction(
  input: FindExportQuoteDraftSourceCandidatesInput
): Promise<ExportQuoteDraftSourceCandidate[]> {
  "use server";

  if (!isExportStagingQuoteDraftEnabled()) {
    throw new Error("Export staging quote draft candidate lookup is not enabled.");
  }

  const actor = await requireCurrentUser();
  if (actor.role !== "super_admin") {
    throw new Error("当前账号不能查询 Finance-confirmed staging 候选。");
  }

  const candidates = await findExportQuoteDraftSourceCandidates(prisma, input);
  assertNoSensitiveExportStagingCandidateFields(candidates);
  return candidates;
}
