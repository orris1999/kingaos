export type QuoteSourceDryRunDecisionStatus =
  | "ready_for_staging_design"
  | "needs_finance_table_fix"
  | "needs_adapter_fix"
  | "addon_only"
  | "blocked"
  | "manual_review_required";

export type QuoteSourceDryRunDecisionInput = {
  adapterId?: string;
  category?: string;
  confidence: "high" | "medium" | "low" | "none";
  hasKjColumn: boolean;
  hasOemColumn: boolean;
  hasProductNameColumn: boolean;
  hasCostCandidateColumn: boolean;
  hasQuoteCandidateColumn: boolean;
  hasPackagingColumn: boolean;
  warnings: string[];
  unsupportedReasons: string[];
};

export type QuoteSourceDryRunDecision = {
  status: QuoteSourceDryRunDecisionStatus;
  reasons: string[];
  nextActions: string[];
  canProceedToStagingDesign: boolean;
  canBeUsedByExportDraft: boolean;
  requiresFinanceConfirmation: boolean;
  requiresAdapterUpdate: boolean;
};

const PRICE_BOUNDARY_REASON = "dry-run 只做结构识别，成本 / 报价候选列不是财务批准价格。";
const EXPORT_CONSUMPTION_BLOCK_REASON = "当前只是 dry-run 结果，尚未进入 staging 导入和财务确认，不能直接给出口部生成报价草稿。";

function normalize(value?: string) {
  return (value ?? "").normalize("NFKC").trim().toLowerCase();
}

function includesAny(value: string | undefined, needles: string[]) {
  const normalized = normalize(value);
  return needles.some((needle) => normalized.includes(normalize(needle)));
}

function isSpecialPackaging(input: QuoteSourceDryRunDecisionInput) {
  return (
    includesAny(input.category, ["特殊包装", "包装及其他"]) ||
    includesAny(input.adapterId, ["special-packaging"])
  );
}

function isWaterTankOrIntercooler(input: QuoteSourceDryRunDecisionInput) {
  return includesAny(input.category, ["水箱", "中冷器"]) || includesAny(input.adapterId, ["radiator", "intercooler"]);
}

function hasPriceCandidateColumn(input: QuoteSourceDryRunDecisionInput) {
  return input.hasCostCandidateColumn || input.hasQuoteCandidateColumn;
}

function getMissingCoreFieldReasons(input: QuoteSourceDryRunDecisionInput) {
  const reasons: string[] = [];

  if (!input.hasKjColumn) {
    reasons.push("缺少 KJ 列，财务需要补充或确认 KJ 编号列。");
  }

  if (!input.hasProductNameColumn) {
    reasons.push("缺少产品名称列，财务需要补充或确认产品名称 / 可展示名称列。");
  }

  if (!hasPriceCandidateColumn(input)) {
    reasons.push("缺少当前有效成本候选列或报价候选列，财务需要确认价格候选字段。");
  }

  return reasons;
}

function hasBlockingUnsupportedReason(input: QuoteSourceDryRunDecisionInput) {
  const text = input.unsupportedReasons.join(" ");

  return includesAny(text, [
    "未匹配到报价表 adapter",
    "文件类型未知",
    "不在该 adapter 支持范围",
    "安全风险",
    "无法识别结构"
  ]);
}

function hasManualReviewSignal(input: QuoteSourceDryRunDecisionInput) {
  const text = [...input.warnings, ...input.unsupportedReasons].join(" ");

  return includesAny(text, ["人工确认", "手工确认", "manual_review", "限销", "风险", "特殊 sheet"]);
}

function createDecision(params: {
  status: QuoteSourceDryRunDecisionStatus;
  reasons: string[];
  nextActions: string[];
  canProceedToStagingDesign: boolean;
  requiresFinanceConfirmation?: boolean;
  requiresAdapterUpdate?: boolean;
}): QuoteSourceDryRunDecision {
  return {
    status: params.status,
    reasons: [...params.reasons, PRICE_BOUNDARY_REASON, EXPORT_CONSUMPTION_BLOCK_REASON],
    nextActions: params.nextActions,
    canProceedToStagingDesign: params.canProceedToStagingDesign,
    canBeUsedByExportDraft: false,
    requiresFinanceConfirmation: params.requiresFinanceConfirmation ?? false,
    requiresAdapterUpdate: params.requiresAdapterUpdate ?? false
  };
}

export function decideQuoteSourceDryRunNextStep(
  input: QuoteSourceDryRunDecisionInput
): QuoteSourceDryRunDecision {
  if (isSpecialPackaging(input)) {
    return createDecision({
      status: "addon_only",
      reasons: ["特殊包装及其他只能作为包装 / 附加项候选，不能作为产品标准报价表。"],
      nextActions: [
        "不要进入产品 KJ 报价草稿 V1。",
        "后续如需要，可单独设计包装 / 附加项 staging。",
        "继续保持价格候选非财务批准提示。"
      ],
      canProceedToStagingDesign: false,
      requiresFinanceConfirmation: true
    });
  }

  if (input.confidence === "none" || hasBlockingUnsupportedReason(input)) {
    return createDecision({
      status: "blocked",
      reasons: ["dry-run 未能可靠识别报价表结构，或存在阻断性 unsupported reason。"],
      nextActions: [
        "先停止进入 staging 设计。",
        "由财务确认文件类型和报价表结构。",
        "由技术确认是否需要新增或修正 adapter。"
      ],
      canProceedToStagingDesign: false,
      requiresFinanceConfirmation: true
    });
  }

  const missingCoreFieldReasons = getMissingCoreFieldReasons(input);
  if (missingCoreFieldReasons.length > 0) {
    return createDecision({
      status: "needs_finance_table_fix",
      reasons: missingCoreFieldReasons,
      nextActions: [
        "请财务补充或确认 KJ 列。",
        "请财务补充或确认产品名称列。",
        "请财务确认当前有效成本候选列或报价候选列。",
        "修正后重新执行 Finance dry-run。"
      ],
      canProceedToStagingDesign: false,
      requiresFinanceConfirmation: true
    });
  }

  if (input.confidence === "medium" || input.confidence === "low") {
    return createDecision({
      status: "needs_adapter_fix",
      reasons: ["报价表字段看起来齐全，但 adapter 匹配置信度不足，需要修正结构配置。"],
      nextActions: [
        "补充 fileNamePattern。",
        "补充 sheetNameHint。",
        "补充 columnMapping 候选列名。",
        "修正 adapter 后重新执行 dry-run。"
      ],
      canProceedToStagingDesign: false,
      requiresAdapterUpdate: true
    });
  }

  if (isWaterTankOrIntercooler(input)) {
    return createDecision({
      status: "ready_for_staging_design",
      reasons: ["水箱 / 中冷器字段齐全且 adapter 匹配充分，可进入 staging 导入模型设计，但 V1 需要行级人工确认规则。"],
      nextActions: [
        "进入 staging 导入模型设计时保留多编码、多规格、多包装和风险字段。",
        "完整标准 KJ 唯一匹配可进入草稿候选。",
        "基础 KJ、多候选、旧码、鼎捷码、OEM、特殊 sheet、风险字段或包装规格不明确时必须行级人工确认。"
      ],
      canProceedToStagingDesign: true,
      requiresFinanceConfirmation: true
    });
  }

  if (hasManualReviewSignal(input)) {
    return createDecision({
      status: "manual_review_required",
      reasons: ["dry-run 结果存在人工确认或风险提示，进入下一步前需要财务 / 技术 / 产品资料人员确认。"],
      nextActions: [
        "先完成人工确认。",
        "确认风险字段是否影响 V1 staging。",
        "确认后再决定是否进入 staging 导入模型设计。"
      ],
      canProceedToStagingDesign: false,
      requiresFinanceConfirmation: true
    });
  }

  return createDecision({
    status: "ready_for_staging_design",
    reasons: ["adapter 置信度高，KJ / 产品名称 / 价格候选核心字段齐全，可以进入后续 staging 导入模型设计。"],
    nextActions: [
      "进入 staging 导入模型设计。",
      "继续保持 dry-run 不直接给出口部消费。",
      "后续 staging 仍需财务确认后才能被出口部用于报价草稿。"
    ],
    canProceedToStagingDesign: true,
    requiresFinanceConfirmation: true
  });
}
