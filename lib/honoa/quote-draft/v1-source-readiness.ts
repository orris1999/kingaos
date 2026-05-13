export type QuoteV1SourceReadiness =
  | "v1_auto_eligible"
  | "v1_eligible_with_conditions"
  | "v1_manual_confirmation_required"
  | "addon_only"
  | "deferred";

export type QuoteV1LineRisk =
  | "base_kj_multi_candidate"
  | "old_kj_code_match"
  | "fumacrm_code_match"
  | "dingjie_code_match"
  | "oem_input_not_supported"
  | "special_sheet_match"
  | "sales_restriction_warning"
  | "packaging_affects_price"
  | "embedded_image_only"
  | "multiple_candidates"
  | "missing_required_spec";

export type QuoteV1SourceReadinessReason =
  | "stable_kj_cost_table"
  | "complex_multi_code_mapping"
  | "complex_packaging_or_spec_mapping"
  | "packaging_addon_not_product_line"
  | "oem_matching_deferred"
  | "image_source_not_stable"
  | "formal_quote_deferred"
  | "finance_pricing_required"
  | "water_tank_manual_confirmation"
  | "intercooler_manual_confirmation"
  | "base_kj_multi_candidate"
  | "risk_sheet_excluded_from_v1";

export type QuoteV1SourceReadinessResult = {
  category: string;
  readiness: QuoteV1SourceReadiness;
  reasons: QuoteV1SourceReadinessReason[];
  warnings: string[];
  allowedForV1ProductDraft: boolean;
  requiresManualConfirmation: boolean;
  allowedAsAddonOnly: boolean;
};

const PRICE_BOUNDARY_WARNINGS = [
  "价格候选不是财务批准价格，不能直接发客户。",
  "V1 只生成报价草稿，不生成正式报价。",
  "正式报价必须后续接 FinancePricing。"
];

const AUTO_ELIGIBLE_CATEGORY_ENTRIES: Array<[string, string[]]> = [
  ["冷凝器", ["condenser", "冷凝器"]],
  ["暖风", ["heater", "暖风", "暖风机"]],
  ["蒸发器", ["evaporator", "蒸发器"]],
  ["水室", ["water_tank_chamber", "water chamber", "水室"]],
  ["全铝自产机冷", ["all_aluminum_intercooler", "全铝自产机冷", "全铝机冷"]]
];

const AUTO_ELIGIBLE_CATEGORIES = new Map(
  AUTO_ELIGIBLE_CATEGORY_ENTRIES.map(([category, aliases]) => [category, aliases.map(normalizeCategoryKey)])
);

type ManualConfirmationCategoryConfig = {
  aliases: string[];
  reason: Extract<
    QuoteV1SourceReadinessReason,
    "water_tank_manual_confirmation" | "intercooler_manual_confirmation"
  >;
  warning: string;
};

const CONDITIONAL_CATEGORY_ENTRIES: Array<[string, ManualConfirmationCategoryConfig]> = [
  [
    "水箱",
    {
      aliases: ["radiator", "water_tank", "水箱"].map(normalizeCategoryKey),
      reason: "water_tank_manual_confirmation",
      warning: "水箱存在多编码、多规格、多包装字段，V1 需要人工确认。"
    }
  ],
  [
    "中冷器",
    {
      aliases: ["intercooler", "中冷器"].map(normalizeCategoryKey),
      reason: "intercooler_manual_confirmation",
      warning: "中冷器存在多编码、多规格、多包装字段，V1 需要人工确认。"
    }
  ]
];

const CONDITIONAL_CATEGORIES = new Map(CONDITIONAL_CATEGORY_ENTRIES);

const ADDON_ONLY_CATEGORY_ENTRIES: Array<[string, string[]]> = [
  ["特殊包装及其他", ["special_packaging", "packaging_addon", "特殊包装及其他", "特殊包装", "其他"]]
];

const ADDON_ONLY_CATEGORIES = new Map(
  ADDON_ONLY_CATEGORY_ENTRIES.map(([category, aliases]) => [category, aliases.map(normalizeCategoryKey)])
);

const DEFERRED_CAPABILITY_WARNINGS = [
  "OEM / OE 自动匹配暂未开放。",
  "Excel 嵌入图片不是稳定主图来源。",
  "历史日期价格列不作为 V1 默认候选。",
  "风险 sheet 不进入 V1 主草稿。"
];

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");
}

function matchesAlias(value: string, aliases: string[]) {
  const key = normalizeCategoryKey(value);
  return aliases.some((alias) => key === alias || key.includes(alias) || alias.includes(key));
}

export function getDeferredQuoteV1Capabilities() {
  return [
    "OEM 自动匹配",
    "Excel 嵌入图片作为稳定主图",
    "正式报价",
    "价格审批",
    "底价 / 毛利",
    "自动发客户",
    "历史日期价格列作为默认候选",
    "风险 sheet 进入主草稿"
  ];
}

export function getQuoteV1SourceReadiness(categoryOrAdapterId: string): QuoteV1SourceReadinessResult {
  const input = categoryOrAdapterId || "未知品类";

  for (const [category, aliases] of AUTO_ELIGIBLE_CATEGORIES.entries()) {
    if (matchesAlias(input, aliases)) {
      return {
        category,
        readiness: "v1_auto_eligible",
        reasons: ["stable_kj_cost_table", "formal_quote_deferred", "finance_pricing_required"],
        warnings: PRICE_BOUNDARY_WARNINGS,
        allowedForV1ProductDraft: true,
        requiresManualConfirmation: false,
        allowedAsAddonOnly: false
      };
    }
  }

  for (const [category, config] of CONDITIONAL_CATEGORIES.entries()) {
    if (matchesAlias(input, config.aliases)) {
      return {
        category,
        readiness: "v1_eligible_with_conditions",
        reasons: [
          config.reason,
          "complex_multi_code_mapping",
          "complex_packaging_or_spec_mapping",
          "base_kj_multi_candidate",
          "oem_matching_deferred",
          "image_source_not_stable",
          "risk_sheet_excluded_from_v1",
          "formal_quote_deferred",
          "finance_pricing_required"
        ],
        warnings: [
          ...PRICE_BOUNDARY_WARNINGS,
          `${category}主成本表可以进入 V1 KJ 批量报价草稿，但需要按行级风险判断是否人工确认。`,
          "完整标准 KJ 唯一命中时可进入 V1 草稿；基础 KJ、多候选、旧码、鼎捷码、OEM、特殊 sheet、风险字段或包装规格不明确时需人工确认。",
          ...DEFERRED_CAPABILITY_WARNINGS
        ],
        allowedForV1ProductDraft: true,
        requiresManualConfirmation: false,
        allowedAsAddonOnly: false
      };
    }
  }

  for (const [category, aliases] of ADDON_ONLY_CATEGORIES.entries()) {
    if (matchesAlias(input, aliases)) {
      return {
        category,
        readiness: "addon_only",
        reasons: [
          "packaging_addon_not_product_line",
          "formal_quote_deferred",
          "finance_pricing_required"
        ],
        warnings: [
          ...PRICE_BOUNDARY_WARNINGS,
          "特殊包装及其他只能作为包装 / 附加项候选，不能作为产品标准报价行。"
        ],
        allowedForV1ProductDraft: false,
        requiresManualConfirmation: true,
        allowedAsAddonOnly: true
      };
    }
  }

  return {
    category: input,
    readiness: "deferred",
    reasons: ["formal_quote_deferred", "finance_pricing_required"],
    warnings: [
      ...PRICE_BOUNDARY_WARNINGS,
      "该品类未进入 V1 source readiness，需技术确认。",
      ...DEFERRED_CAPABILITY_WARNINGS
    ],
    allowedForV1ProductDraft: false,
    requiresManualConfirmation: true,
    allowedAsAddonOnly: false
  };
}

export function isV1AutoEligibleQuoteCategory(category: string) {
  return getQuoteV1SourceReadiness(category).readiness === "v1_auto_eligible";
}

export function requiresV1ManualConfirmation(category: string) {
  return getQuoteV1SourceReadiness(category).requiresManualConfirmation;
}

export function isV1EligibleWithConditionsQuoteCategory(category: string) {
  return getQuoteV1SourceReadiness(category).readiness === "v1_eligible_with_conditions";
}

export function isQuoteAddonOnlyCategory(category: string) {
  return getQuoteV1SourceReadiness(category).allowedAsAddonOnly;
}
