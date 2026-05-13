import type { PrismaClient } from "@prisma/client";
import {
  canExposeStagingRowToExportDraft,
  mapStagingRowToExportQuoteDraftSourceCandidate,
  normalizeFindExportQuoteDraftSourceCandidatesInput
} from "./export-staging-consumption-types";
import type {
  ExportQuoteDraftSourceCandidate,
  ExportReadableQuoteSourceStagingBatch,
  ExportReadableQuoteSourceStagingRow,
  FindExportQuoteDraftSourceCandidatesInput
} from "./export-staging-consumption-types";

type ExportStagingConsumptionPrisma = Pick<PrismaClient, "quoteSourceStagingRow">;

type StoredExportCandidateRow = {
  id: string;
  standardKjCode: string | null;
  baseKjCode: string | null;
  oldKjNo: string | null;
  productNameCandidate: string | null;
  category: string | null;
  modelCandidate: string | null;
  specificationCandidate: string | null;
  tradeMode: string;
  priceCandidateStatus: string;
  hasCostCandidate: boolean;
  hasQuoteCandidate: boolean;
  hasPackagingInfo: boolean;
  hasOemInfo: boolean;
  visibility: string;
  rowStatus: string;
  warnings: unknown;
  batch: {
    id: string;
    status: string;
  };
};

const EXPORT_EXPOSABLE_PRICE_STATUSES = [
  "cost_candidate_available",
  "quote_candidate_available",
  "not_finance_approved"
] as const;

export async function findExportQuoteDraftSourceCandidates(
  prisma: ExportStagingConsumptionPrisma,
  input: FindExportQuoteDraftSourceCandidatesInput
): Promise<ExportQuoteDraftSourceCandidate[]> {
  const normalizedInput = normalizeFindExportQuoteDraftSourceCandidatesInput(input);
  const codeTerms = getKjCodeSearchTerms(normalizedInput.kjCode, normalizedInput.normalizedKjCode);

  const rows = await prisma.quoteSourceStagingRow.findMany({
    where: {
      batch: {
        status: "finance_confirmed"
      },
      visibility: "export_draft_candidate",
      rowStatus: "candidate",
      priceCandidateStatus: {
        in: [...EXPORT_EXPOSABLE_PRICE_STATUSES]
      },
      category: normalizedInput.category,
      AND: [
        {
          OR: [
            { standardKjCode: { in: codeTerms } },
            { baseKjCode: { in: codeTerms } },
            { oldKjNo: { in: codeTerms } }
          ]
        },
        ...(normalizedInput.tradeMode
          ? [
              {
                tradeMode:
                  normalizedInput.tradeMode === "unknown"
                    ? "unknown"
                    : { in: [normalizedInput.tradeMode, "unknown"] }
              }
            ]
          : [])
      ]
    },
    include: {
      batch: {
        select: {
          id: true,
          status: true
        }
      }
    },
    orderBy: [{ sourceRowNumber: "asc" }, { createdAt: "asc" }],
    take: Math.min(normalizedInput.limit * 2, 100)
  });

  return rows
    .map(mapStoredRowForExport)
    .filter(({ row, batch }) => canExposeStagingRowToExportDraft(row, batch))
    .map(({ row, batch }) => mapStagingRowToExportQuoteDraftSourceCandidate(row, batch))
    .slice(0, normalizedInput.limit);
}

function getKjCodeSearchTerms(kjCode?: string, normalizedKjCode?: string) {
  return Array.from(
    new Set(
      [kjCode, normalizedKjCode, normalizeStagingKjCodeForLookup(kjCode), normalizeStagingKjCodeForLookup(normalizedKjCode)]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function normalizeStagingKjCodeForLookup(value?: string) {
  return value
    ?.normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—－]/g, "-")
    .replace(/\s+/g, "");
}

function mapStoredRowForExport(row: StoredExportCandidateRow): {
  row: ExportReadableQuoteSourceStagingRow;
  batch: ExportReadableQuoteSourceStagingBatch;
} {
  return {
    batch: {
      id: row.batch.id,
      status: row.batch.status as ExportReadableQuoteSourceStagingBatch["status"]
    },
    row: {
      id: row.id,
      standardKjCode: row.standardKjCode ?? undefined,
      baseKjCode: row.baseKjCode ?? undefined,
      oldKjNo: row.oldKjNo ?? undefined,
      productNameCandidate: row.productNameCandidate ?? undefined,
      category: row.category ?? undefined,
      modelCandidate: row.modelCandidate ?? undefined,
      specificationCandidate: row.specificationCandidate ?? undefined,
      tradeMode: row.tradeMode as ExportReadableQuoteSourceStagingRow["tradeMode"],
      priceCandidateStatus: row.priceCandidateStatus as ExportReadableQuoteSourceStagingRow["priceCandidateStatus"],
      hasCostCandidate: row.hasCostCandidate,
      hasQuoteCandidate: row.hasQuoteCandidate,
      hasPackagingInfo: row.hasPackagingInfo,
      hasOemInfo: row.hasOemInfo,
      visibility: row.visibility as ExportReadableQuoteSourceStagingRow["visibility"],
      rowStatus: row.rowStatus as ExportReadableQuoteSourceStagingRow["rowStatus"],
      warnings: asStringArray(row.warnings)
    }
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
