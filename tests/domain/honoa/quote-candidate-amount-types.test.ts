import { describe, expect, it } from "vitest";
import {
  createQuoteCandidateAmountPolicy,
  getQuoteCandidateAmountDisclosure,
  getQuoteCandidateAmountTradeModeDecision
} from "@/lib/honoa/quote-draft";

const FORBIDDEN_FIELD_NAMES = [
  "amount",
  "unitPrice",
  "costPrice",
  "quotePrice",
  "financeApprovedPrice",
  "approvedPrice",
  "officialQuote",
  "sentToCustomer"
];

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)]);
}

describe("Quote Task 009M candidate amount domain types", () => {
  it("keeps candidate amount policy outside FinanceApprovedPrice and customer-sendable quote boundaries", () => {
    const policy = createQuoteCandidateAmountPolicy({ tradeMode: "export_usd" });

    expect(policy.isFinanceApprovedPrice).toBe(false);
    expect(policy.canBeSentToCustomer).toBe(false);
    expect(policy.requiresFinancePricing).toBe(true);
    expect(policy.warnings.join(" ")).toContain("候选金额不是 FinanceApprovedPrice");
    expect(policy.warnings.join(" ")).toContain("不能直接发客户");
  });

  it("maps export_usd to USD candidate source", () => {
    const decision = getQuoteCandidateAmountTradeModeDecision("export_usd");
    const policy = createQuoteCandidateAmountPolicy({ tradeMode: "export_usd" });

    expect(decision.autoSelectsCandidateSource).toBe(true);
    expect(decision.currency).toBe("USD");
    expect(decision.sourceColumnLabel).toContain("出口成本报价");
    expect(policy.currency).toBe("USD");
    expect(policy.status).toBe("candidate_available");
  });

  it("maps domestic_cny to CNY candidate source", () => {
    const decision = getQuoteCandidateAmountTradeModeDecision("domestic_cny");
    const policy = createQuoteCandidateAmountPolicy({ tradeMode: "domestic_cny" });

    expect(decision.autoSelectsCandidateSource).toBe(true);
    expect(decision.currency).toBe("CNY");
    expect(decision.sourceColumnLabel).toContain("出口部内销成本报价");
    expect(policy.currency).toBe("CNY");
    expect(policy.status).toBe("candidate_available");
  });

  it("does not automatically select a candidate source for unknown trade mode", () => {
    const decision = getQuoteCandidateAmountTradeModeDecision("unknown");
    const policy = createQuoteCandidateAmountPolicy({ tradeMode: "unknown" });

    expect(decision.autoSelectsCandidateSource).toBe(false);
    expect(decision.currency).toBeUndefined();
    expect(decision.sourceColumnLabel).toBeUndefined();
    expect(policy.currency).toBeUndefined();
    expect(policy.status).toBe("requires_finance_review");
    expect(policy.warnings.join(" ")).toContain("不自动选择候选金额");
  });

  it("does not define concrete price or formal quote fields in policy output", () => {
    const policy = createQuoteCandidateAmountPolicy({ tradeMode: "export_usd" });
    const keys = collectKeys(policy);

    for (const field of FORBIDDEN_FIELD_NAMES) {
      expect(keys).not.toContain(field);
    }
  });

  it("does not define sensitive fields in disclosure output", () => {
    const policy = createQuoteCandidateAmountPolicy({ tradeMode: "domestic_cny", visibility: "masked_for_export" });
    const disclosure = getQuoteCandidateAmountDisclosure(policy, "export");
    const keys = collectKeys(disclosure);

    for (const field of FORBIDDEN_FIELD_NAMES) {
      expect(keys).not.toContain(field);
    }
  });

  it("requires non-formal quote warning for export_draft_visible", () => {
    const policy = createQuoteCandidateAmountPolicy({
      tradeMode: "export_usd",
      visibility: "export_draft_visible"
    });
    const disclosure = getQuoteCandidateAmountDisclosure(policy, "export");

    expect(disclosure.canDisplayCandidateValue).toBe(true);
    expect(disclosure.warnings.join(" ")).toContain("非正式报价");
    expect(disclosure.warnings.join(" ")).toContain("不是正式报价");
    expect(disclosure.warnings.join(" ")).toContain("不能直接发客户");
  });

  it("keeps masked_for_export from displaying candidate value", () => {
    const policy = createQuoteCandidateAmountPolicy({
      tradeMode: "domestic_cny",
      visibility: "masked_for_export"
    });
    const disclosure = getQuoteCandidateAmountDisclosure(policy, "export");

    expect(disclosure.canDisplayCandidateValue).toBe(false);
    expect(disclosure.visibleSignals).toContain("candidate_exists");
    expect(disclosure.visibleSignals).toContain("currency");
    expect(disclosure.visibleSignals).toContain("requires_finance_review");
    expect(disclosure.warnings.join(" ")).toContain("不显示具体金额");
  });
});
