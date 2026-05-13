import { describe, expect, it } from "vitest";
import {
  canExposeStagingRowToExportDraft,
  getExportQuoteDraftSourceCandidateQueryDecision,
  mapStagingRowToExportQuoteDraftSourceCandidate,
  normalizeFindExportQuoteDraftSourceCandidatesInput
} from "@/lib/honoa/quote-draft/export-staging-consumption-types";
import type {
  ExportReadableQuoteSourceStagingBatch,
  ExportReadableQuoteSourceStagingRow
} from "@/lib/honoa/quote-draft/export-staging-consumption-types";

function makeBatch(
  overrides: Partial<ExportReadableQuoteSourceStagingBatch> = {}
): ExportReadableQuoteSourceStagingBatch {
  return {
    id: "batch-export-consumption-mock",
    status: "finance_confirmed",
    ...overrides
  };
}

function makeRow(
  overrides: Partial<ExportReadableQuoteSourceStagingRow> = {}
): ExportReadableQuoteSourceStagingRow {
  return {
    id: "row-export-consumption-mock",
    standardKjCode: "KJMOCK-COND-001",
    baseKjCode: "KJMOCK-COND",
    oldKjNo: "OLD-KJMOCK-COND-001",
    productNameCandidate: "Mock condenser",
    category: "冷凝器",
    modelCandidate: "Mock model",
    specificationCandidate: "Mock spec",
    tradeMode: "export_usd",
    priceCandidateStatus: "cost_candidate_available",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: false,
    hasOemInfo: false,
    visibility: "export_draft_candidate",
    rowStatus: "candidate",
    warnings: ["Mock staging warning"],
    ...overrides
  };
}

describe("Export quote draft consumption of finance-confirmed staging data", () => {
  it("exposes only finance_confirmed export_draft_candidate candidate rows", () => {
    expect(canExposeStagingRowToExportDraft(makeRow(), makeBatch())).toBe(true);
  });

  it("rejects rows when the batch is not finance_confirmed", () => {
    expect(canExposeStagingRowToExportDraft(makeRow(), makeBatch({ status: "dry_run_passed" }))).toBe(false);
    expect(canExposeStagingRowToExportDraft(makeRow(), makeBatch({ status: "cancelled" }))).toBe(false);
  });

  it("rejects non-export visibilities", () => {
    expect(canExposeStagingRowToExportDraft(makeRow({ visibility: "finance_only" }), makeBatch())).toBe(false);
    expect(canExposeStagingRowToExportDraft(makeRow({ visibility: "internal_risk_only" }), makeBatch())).toBe(false);
  });

  it("rejects non-candidate row statuses", () => {
    expect(canExposeStagingRowToExportDraft(makeRow({ rowStatus: "needs_manual_review" }), makeBatch())).toBe(false);
    expect(canExposeStagingRowToExportDraft(makeRow({ rowStatus: "addon_only" }), makeBatch())).toBe(false);
    expect(canExposeStagingRowToExportDraft(makeRow({ rowStatus: "blocked" }), makeBatch())).toBe(false);
    expect(canExposeStagingRowToExportDraft(makeRow({ rowStatus: "ignored" }), makeBatch())).toBe(false);
  });

  it("rejects missing and requires_finance_review price statuses", () => {
    expect(canExposeStagingRowToExportDraft(makeRow({ priceCandidateStatus: "missing" }), makeBatch())).toBe(false);
    expect(
      canExposeStagingRowToExportDraft(makeRow({ priceCandidateStatus: "requires_finance_review" }), makeBatch())
    ).toBe(false);
  });

  it("allows not_finance_approved as a draft candidate while preserving formal quote warnings", () => {
    const candidate = mapStagingRowToExportQuoteDraftSourceCandidate(
      makeRow({ priceCandidateStatus: "not_finance_approved" }),
      makeBatch()
    );

    expect(candidate.priceCandidateStatus).toBe("not_finance_approved");
    expect(candidate.warnings.join(" ")).toContain("不是正式报价");
    expect(candidate.warnings.join(" ")).toContain("不是财务批准价格");
  });

  it("outputs a redacted candidate without sensitive price or formal quote fields", () => {
    const candidate = mapStagingRowToExportQuoteDraftSourceCandidate(makeRow(), makeBatch());
    const serialized = JSON.stringify(candidate);

    expect(candidate).toMatchObject({
      source: "finance_confirmed_staging",
      stagingBatchId: "batch-export-consumption-mock",
      stagingRowId: "row-export-consumption-mock",
      standardKjCode: "KJMOCK-COND-001",
      productNameCandidate: "Mock condenser",
      tradeMode: "export_usd",
      hasCostCandidate: true
    });
    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("grossMargin");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("preserves water tank and intercooler manual-confirmation warning", () => {
    const radiator = mapStagingRowToExportQuoteDraftSourceCandidate(makeRow({ category: "水箱" }), makeBatch());
    const intercooler = mapStagingRowToExportQuoteDraftSourceCandidate(makeRow({ category: "中冷器" }), makeBatch());

    expect(radiator.warnings.join(" ")).toContain("多编码、多规格、多包装");
    expect(intercooler.warnings.join(" ")).toContain("多编码、多规格、多包装");
  });

  it("does not expose special packaging as a product quote candidate", () => {
    const row = makeRow({ category: "特殊包装及其他", rowStatus: "candidate" });

    expect(canExposeStagingRowToExportDraft(row, makeBatch())).toBe(false);
    expect(() => mapStagingRowToExportQuoteDraftSourceCandidate(row, makeBatch())).toThrow(
      "staging row cannot be exposed"
    );
  });

  it("rejects query input without KJ code and caps limit at 50", () => {
    expect(() => normalizeFindExportQuoteDraftSourceCandidatesInput({ category: "冷凝器" })).toThrow(
      "kjCode or normalizedKjCode is required"
    );

    const input = normalizeFindExportQuoteDraftSourceCandidatesInput({
      kjCode: " KJMOCK-COND-001 ",
      limit: 120
    });
    expect(input.kjCode).toBe("KJMOCK-COND-001");
    expect(input.limit).toBe(50);
  });

  it("keeps OEM automatic matching unsupported", () => {
    const decision = getExportQuoteDraftSourceCandidateQueryDecision({ kjCode: "16400-XXXXX" });

    expect(decision.supported).toBe(false);
    if (!decision.supported) {
      expect(decision.unsupportedReason).toBe("oem_matching_not_supported");
      expect(decision.requiresTechnicalReview).toBe(true);
      expect(decision.warnings.join(" ")).toContain("OEM / OE 自动匹配暂未开放");
    }
  });

  it("returns a supported KJ query decision with price boundary warnings", () => {
    const decision = getExportQuoteDraftSourceCandidateQueryDecision({
      normalizedKjCode: "KJMOCK-COND-001",
      limit: 10
    });

    expect(decision.supported).toBe(true);
    expect(decision.input.limit).toBe(10);
    expect(decision.warnings.join(" ")).toContain("finance_confirmed");
    expect(decision.warnings.join(" ")).toContain("不是正式报价");
  });
});
