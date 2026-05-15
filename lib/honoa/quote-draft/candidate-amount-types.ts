export type QuoteCandidateAmountSource =
  | "finance_quote_source_staging"
  | "manual_finance_review"
  | "future_finance_pricing";

export type QuoteCandidateAmountVisibility =
  | "finance_only"
  | "export_draft_visible"
  | "masked_for_export";

export type QuoteCandidateAmountStatus =
  | "candidate_available"
  | "missing"
  | "requires_finance_review"
  | "not_finance_approved";

export type QuoteCandidateAmountTradeMode = "export_usd" | "domestic_cny" | "unknown";

export type QuoteCandidateAmountCurrency = "USD" | "CNY";

export const QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS = {
  export_usd: {
    sourceColumnName: "2026.5.11出口成本报价",
    sourceColumnDate: "2026.5.11",
    currency: "USD"
  },
  domestic_cny: {
    sourceColumnName: "2026.5.11出口部内销成本报价",
    sourceColumnDate: "2026.5.11",
    currency: "CNY"
  }
} as const satisfies Record<
  Exclude<QuoteCandidateAmountTradeMode, "unknown">,
  {
    sourceColumnName: string;
    sourceColumnDate: string;
    currency: QuoteCandidateAmountCurrency;
  }
>;

export type QuoteCandidateAmountPolicy = {
  tradeMode: QuoteCandidateAmountTradeMode;
  source: QuoteCandidateAmountSource;
  visibility: QuoteCandidateAmountVisibility;
  status: QuoteCandidateAmountStatus;
  currency?: QuoteCandidateAmountCurrency;
  isFinanceApprovedPrice: false;
  canBeSentToCustomer: false;
  requiresFinancePricing: true;
  warnings: string[];
};

export type QuoteCandidateAmountPolicyInput = {
  tradeMode: QuoteCandidateAmountTradeMode;
  source?: QuoteCandidateAmountSource;
  visibility?: QuoteCandidateAmountVisibility;
  status?: QuoteCandidateAmountStatus;
};

export type QuoteCandidateAmountTradeModeDecision = {
  tradeMode: QuoteCandidateAmountTradeMode;
  autoSelectsCandidateSource: boolean;
  currency?: QuoteCandidateAmountCurrency;
  sourceColumnLabel?: string;
  warnings: string[];
};

export type QuoteCandidateAmountDisclosureAudience = "finance" | "export";

export type QuoteCandidateAmountDisclosure = {
  audience: QuoteCandidateAmountDisclosureAudience;
  visibility: QuoteCandidateAmountVisibility;
  canDisplayCandidateValue: boolean;
  visibleSignals: Array<
    | "candidate_exists"
    | "currency"
    | "requires_finance_review"
    | "non_formal_quote_warning"
  >;
  warnings: string[];
};

export const QUOTE_CANDIDATE_AMOUNT_WARNINGS = {
  notFinanceApproved: "候选金额不是 FinanceApprovedPrice。",
  notFormalQuote: "候选金额不是正式报价，不能直接发客户。",
  requiresFinancePricing: "正式报价必须后续进入 FinancePricing / 财务审批 / 价格快照。",
  exportDraftVisible: "export_draft_visible 只能用于草稿预览，必须标注非正式报价。",
  maskedForExport: "masked_for_export 只允许出口部看到有候选金额、币种和需财务确认，不显示具体金额。",
  unknownTradeMode: "unknown tradeMode 不自动选择候选金额，请选择外销 USD 或内销 CNY。"
} as const;

function uniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

export function getQuoteCandidateAmountTradeModeDecision(
  tradeMode: QuoteCandidateAmountTradeMode
): QuoteCandidateAmountTradeModeDecision {
  if (tradeMode === "export_usd") {
    return {
      tradeMode,
      autoSelectsCandidateSource: true,
      currency: QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS.export_usd.currency,
      sourceColumnLabel: QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS.export_usd.sourceColumnName,
      warnings: [
        "外销 / 境外收美金 / 有退税场景使用出口成本候选来源。",
        QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFinanceApproved
      ]
    };
  }

  if (tradeMode === "domestic_cny") {
    return {
      tradeMode,
      autoSelectsCandidateSource: true,
      currency: QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS.domestic_cny.currency,
      sourceColumnLabel: QUOTE_CANDIDATE_AMOUNT_SOURCE_COLUMNS.domestic_cny.sourceColumnName,
      warnings: [
        "内销 / 收人民币场景使用出口部内销成本候选来源。",
        QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFinanceApproved
      ]
    };
  }

  return {
    tradeMode,
    autoSelectsCandidateSource: false,
    warnings: [
      QUOTE_CANDIDATE_AMOUNT_WARNINGS.unknownTradeMode,
      QUOTE_CANDIDATE_AMOUNT_WARNINGS.requiresFinancePricing
    ]
  };
}

export function createQuoteCandidateAmountPolicy(
  input: QuoteCandidateAmountPolicyInput
): QuoteCandidateAmountPolicy {
  const decision = getQuoteCandidateAmountTradeModeDecision(input.tradeMode);
  const status = input.status ?? (decision.autoSelectsCandidateSource ? "candidate_available" : "requires_finance_review");
  const visibility = input.visibility ?? "masked_for_export";

  return {
    tradeMode: input.tradeMode,
    source: input.source ?? "finance_quote_source_staging",
    visibility,
    status,
    currency: decision.currency,
    isFinanceApprovedPrice: false,
    canBeSentToCustomer: false,
    requiresFinancePricing: true,
    warnings: uniqueWarnings([
      ...decision.warnings,
      QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFinanceApproved,
      QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFormalQuote,
      QUOTE_CANDIDATE_AMOUNT_WARNINGS.requiresFinancePricing,
      visibility === "export_draft_visible" ? QUOTE_CANDIDATE_AMOUNT_WARNINGS.exportDraftVisible : "",
      visibility === "masked_for_export" ? QUOTE_CANDIDATE_AMOUNT_WARNINGS.maskedForExport : ""
    ])
  };
}

export function getQuoteCandidateAmountDisclosure(
  policy: QuoteCandidateAmountPolicy,
  audience: QuoteCandidateAmountDisclosureAudience
): QuoteCandidateAmountDisclosure {
  if (audience === "finance" && policy.visibility === "finance_only") {
    return {
      audience,
      visibility: policy.visibility,
      canDisplayCandidateValue: true,
      visibleSignals: ["candidate_exists", "currency", "requires_finance_review"],
      warnings: policy.warnings
    };
  }

  if (audience === "export" && policy.visibility === "export_draft_visible") {
    return {
      audience,
      visibility: policy.visibility,
      canDisplayCandidateValue: true,
      visibleSignals: ["candidate_exists", "currency", "requires_finance_review", "non_formal_quote_warning"],
      warnings: uniqueWarnings([
        ...policy.warnings,
        QUOTE_CANDIDATE_AMOUNT_WARNINGS.exportDraftVisible,
        QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFormalQuote
      ])
    };
  }

  if (audience === "export" && policy.visibility === "masked_for_export") {
    return {
      audience,
      visibility: policy.visibility,
      canDisplayCandidateValue: false,
      visibleSignals: ["candidate_exists", "currency", "requires_finance_review", "non_formal_quote_warning"],
      warnings: uniqueWarnings([
        ...policy.warnings,
        QUOTE_CANDIDATE_AMOUNT_WARNINGS.maskedForExport,
        QUOTE_CANDIDATE_AMOUNT_WARNINGS.notFormalQuote
      ])
    };
  }

  return {
    audience,
    visibility: policy.visibility,
    canDisplayCandidateValue: false,
    visibleSignals: ["requires_finance_review", "non_formal_quote_warning"],
    warnings: uniqueWarnings([
      ...policy.warnings,
      "当前可见性不允许该受众查看候选金额。"
    ])
  };
}
