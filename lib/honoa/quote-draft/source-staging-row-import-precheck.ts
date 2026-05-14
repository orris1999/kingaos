export type QuoteSourceRowImportPrecheckStatus =
  | "ready_for_row_import_design"
  | "needs_adapter_review"
  | "needs_finance_review"
  | "blocked";

export type QuoteSourceRowImportPrecheckInput = {
  batchId: string;
  adapterId?: string;
  category?: string;
  status: string;
  dryRunDecisionStatus: string;
  rowCount: number;
  uploadDryRunSummary?: unknown;
  uploadDryRunWarnings?: string[];
};

export type QuoteSourceRowImportPrecheckResult = {
  status: QuoteSourceRowImportPrecheckStatus;
  canDesignRowImport: boolean;
  canImportRowsNow: false;
  reasons: string[];
  nextActions: string[];
  warnings: string[];
};

const PRICE_BOUNDARY_WARNING = "行级导入前检查不会导入价格，不会保存 KJ 行 / OEM 行，也不会创建 staging rows。";
const FORMAL_QUOTE_WARNING = "staging batch 不是正式价格表，不能生成报价草稿或正式报价。";

const BLOCKED_BATCH_STATUSES = new Set(["cancelled", "adapter_fix_required", "finance_table_fix_required"]);

function normalizeWarnings(input: QuoteSourceRowImportPrecheckInput) {
  const warnings = Array.isArray(input.uploadDryRunWarnings)
    ? input.uploadDryRunWarnings.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return Array.from(new Set([...warnings, PRICE_BOUNDARY_WARNING, FORMAL_QUOTE_WARNING]));
}

function result(params: {
  status: QuoteSourceRowImportPrecheckStatus;
  canDesignRowImport: boolean;
  reasons: string[];
  nextActions: string[];
  warnings: string[];
}): QuoteSourceRowImportPrecheckResult {
  return {
    status: params.status,
    canDesignRowImport: params.canDesignRowImport,
    canImportRowsNow: false,
    reasons: params.reasons,
    nextActions: params.nextActions,
    warnings: params.warnings
  };
}

export function precheckQuoteSourceStagingRowImport(
  input: QuoteSourceRowImportPrecheckInput
): QuoteSourceRowImportPrecheckResult {
  const warnings = normalizeWarnings(input);
  const reasons: string[] = [];
  const nextActions: string[] = [];

  if (!input.batchId.trim()) {
    reasons.push("缺少 batchId，不能进入行级导入设计。");
  }
  if (!input.adapterId?.trim()) {
    reasons.push("缺少 adapterId，不能进入行级导入设计。");
  }
  if (!input.category?.trim()) {
    reasons.push("缺少 category，不能进入行级导入设计。");
  }

  if (BLOCKED_BATCH_STATUSES.has(input.status) || input.status !== "dry_run_passed") {
    reasons.push("batch status 必须是 dry_run_passed，当前批次不能进入行级导入设计。");
  }

  if (input.rowCount > 0) {
    reasons.push("当前 batch 已有 staging rows，不应重复进入行级导入设计。");
    nextActions.push("先核对现有 rows 的来源和状态，避免重复导入。");
  }

  if (reasons.length > 0) {
    return result({
      status: "blocked",
      canDesignRowImport: false,
      reasons,
      nextActions: [
        ...nextActions,
        "先修正 batch metadata，再重新执行行级导入前检查。",
        "不要创建 QuoteSourceStagingRow，不要导入价格。"
      ],
      warnings
    });
  }

  if (input.dryRunDecisionStatus === "needs_adapter_fix") {
    return result({
      status: "needs_adapter_review",
      canDesignRowImport: false,
      reasons: ["dry-run decision 要求修正 adapter，不能直接进入行级导入设计。"],
      nextActions: ["由技术先修正 adapter 配置。", "修正后重新 dry-run，再重新确认 staging batch。"],
      warnings
    });
  }

  if (input.dryRunDecisionStatus === "needs_finance_table_fix") {
    return result({
      status: "needs_finance_review",
      canDesignRowImport: false,
      reasons: ["dry-run decision 要求财务修正报价表结构，不能直接进入行级导入设计。"],
      nextActions: ["由财务确认报价表列名和结构。", "修正后重新上传或 dry-run。"],
      warnings
    });
  }

  if (input.dryRunDecisionStatus === "blocked" || input.dryRunDecisionStatus === "addon_only") {
    return result({
      status: "blocked",
      canDesignRowImport: false,
      reasons: ["当前 dry-run decision 不适合进入产品行级导入设计。"],
      nextActions: ["不要进入 KJ / 价格候选行级导入。", "如确需处理，另开包装 / 附加项或 adapter 修正任务。"],
      warnings
    });
  }

  if (input.dryRunDecisionStatus === "manual_review_required") {
    return result({
      status: "needs_finance_review",
      canDesignRowImport: true,
      reasons: ["manual_review_required 不代表失败；它表示结构识别已完成，但行级导入设计前需要人工确认。"],
      nextActions: [
        "确认 adapter 是否正确。",
        "确认 category 是否正确。",
        "确认 dry-run warnings 是否可接受。",
        "确认后再设计行级 KJ / 产品候选解析规则。",
        "当前仍不能直接导入 rows。"
      ],
      warnings
    });
  }

  if (input.dryRunDecisionStatus === "ready_for_staging_design") {
    return result({
      status: "ready_for_row_import_design",
      canDesignRowImport: true,
      reasons: ["batch metadata 已满足进入行级导入设计的前置条件。"],
      nextActions: [
        "设计行级导入字段映射和人工确认规则。",
        "继续保持不保存具体价格 / KJ 行 / OEM 行，直到 row import 任务明确批准。",
        "当前仍不能直接导入 rows。"
      ],
      warnings
    });
  }

  return result({
    status: "blocked",
    canDesignRowImport: false,
    reasons: [`未知 dry-run decision：${input.dryRunDecisionStatus}`],
    nextActions: ["先确认 dry-run decision 定义，再决定是否进入行级导入设计。"],
    warnings
  });
}
