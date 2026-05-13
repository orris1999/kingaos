import { describe, expect, it } from "vitest";
import {
  assertQuoteSourceStagingBatchTransition,
  canTransitionQuoteSourceStagingBatch
} from "@/lib/honoa/quote-draft";
import type { QuoteSourceStagingAuditMetadata } from "@/lib/honoa/quote-draft";

describe("quote source staging batch status transitions", () => {
  it("allows the approved staging transition paths", () => {
    expect(canTransitionQuoteSourceStagingBatch("draft", "dry_run_passed")).toBe(true);
    expect(canTransitionQuoteSourceStagingBatch("dry_run_passed", "finance_confirmed")).toBe(true);
    expect(canTransitionQuoteSourceStagingBatch("dry_run_passed", "adapter_fix_required")).toBe(true);
    expect(canTransitionQuoteSourceStagingBatch("dry_run_passed", "finance_table_fix_required")).toBe(true);
    expect(canTransitionQuoteSourceStagingBatch("dry_run_passed", "cancelled")).toBe(true);
    expect(canTransitionQuoteSourceStagingBatch("adapter_fix_required", "dry_run_passed")).toBe(true);
    expect(canTransitionQuoteSourceStagingBatch("finance_table_fix_required", "dry_run_passed")).toBe(true);
    expect(canTransitionQuoteSourceStagingBatch("finance_confirmed", "cancelled")).toBe(true);
  });

  it("rejects terminal or backwards staging transition paths", () => {
    expect(canTransitionQuoteSourceStagingBatch("finance_confirmed", "draft")).toBe(false);
    expect(canTransitionQuoteSourceStagingBatch("finance_confirmed", "dry_run_passed")).toBe(false);
    expect(canTransitionQuoteSourceStagingBatch("cancelled", "finance_confirmed")).toBe(false);
    expect(canTransitionQuoteSourceStagingBatch("cancelled", "dry_run_passed")).toBe(false);
    expect(canTransitionQuoteSourceStagingBatch("cancelled", "adapter_fix_required")).toBe(false);
    expect(canTransitionQuoteSourceStagingBatch("cancelled", "finance_table_fix_required")).toBe(false);
  });

  it("throws a clear error for invalid transitions", () => {
    expect(() =>
      assertQuoteSourceStagingBatchTransition("cancelled", "finance_confirmed")
    ).toThrow("Invalid quote source staging status transition: cancelled -> finance_confirmed");
  });

  it("defines audit metadata shape for future AuditLog integration", () => {
    const metadata: QuoteSourceStagingAuditMetadata = {
      batchId: "batch-mock",
      sourceFileName: "mock.xlsx",
      adapterId: "radiator-cost-2026",
      category: "水箱",
      previousStatus: "dry_run_passed",
      nextStatus: "finance_confirmed",
      actorUserId: "finance-user",
      actorName: "Finance User",
      reason: "财务确认结构可进入 staging 候选"
    };

    expect(metadata.previousStatus).toBe("dry_run_passed");
    expect(metadata.nextStatus).toBe("finance_confirmed");
    expect(metadata.actorUserId).toBe("finance-user");
    expect(metadata.reason).toContain("财务确认");
  });
});
