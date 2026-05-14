import { normalizeKjCode } from "./normalize";
import { getQuoteSourceWorkbookConfig } from "./source-adapters";
import type { QuoteColumnMapping } from "./source-adapter-types";
import type { CreateQuoteSourceStagingRowInput } from "./source-staging-repository-types";

export type QuoteSourceWorkbookRowLike = {
  sourceRowNumber?: number;
  columns: Record<string, unknown>;
};

export type QuoteSourceRowImportInput = {
  batchId: string;
  adapterId: string;
  category: string;
  sourceFileName: string;
  rows: QuoteSourceWorkbookRowLike[];
};

const SUPPORTED_ADAPTER_ID = "condenser-cost-2026";
const SUPPORTED_CATEGORY = "冷凝器";

const PRICE_BOUNDARY_WARNING = "行级导入 mapper 只保存脱敏 metadata，不保存具体价格。";
const EXPORT_VISIBILITY_WARNING = "行级导入默认 visibility=finance_only，不自动给出口部消费。";

const EXTRA_CONDENSER_MAPPING: QuoteColumnMapping = {
  kjCode: ["KJ", "KJ号", "KJ编码", "KJ-编码", "标准编码"],
  oldCode: ["旧 KJ.NO", "原KJ.NO", "旧编码"],
  erpCode: ["ERP KJ-编码", "鼎捷编码", "鼎捷品号"],
  fumacrmCode: ["孚盟 KJ-编码", "孚盟编码"],
  oemCode: ["OEM", "OE", "原厂号"],
  productName: ["产品名称", "品名", "车型车系"],
  model: ["车型", "车型车系", "适用车型", "车系"],
  specification: ["规格", "芯体总成尺寸", "纸箱尺寸", "波距", "波距代码"],
  costPrice: ["出口成本", "出口成本价", "出口成本报价"],
  quotePrice: ["报价", "报价候选", "单价"],
  packaging: ["包装", "纸箱", "纸箱尺寸"],
  notes: ["备注", "是否允限销", "能否报价", "限销备注"]
};

function normalizeHeader(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.normalize("NFKC").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).normalize("NFKC").trim();
  return "";
}

function hasValue(value: unknown) {
  return normalizeValue(value).length > 0;
}

function mergeMappings(adapterId: string): QuoteColumnMapping {
  const config = getQuoteSourceWorkbookConfig(adapterId);
  const primary = config?.primarySheets[0]?.columnMapping ?? {};
  const merged: QuoteColumnMapping = {};
  const keys = new Set([...Object.keys(primary), ...Object.keys(EXTRA_CONDENSER_MAPPING)]) as Set<keyof QuoteColumnMapping>;

  for (const key of keys) {
    merged[key] = [...(primary[key] ?? []), ...(EXTRA_CONDENSER_MAPPING[key] ?? [])];
  }

  return merged;
}

function findColumnValue(columns: Record<string, unknown>, aliases: string[] = []) {
  const entries = Object.entries(columns);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const found = entries.find(([key]) => {
      const normalizedKey = normalizeHeader(key);
      return normalizedKey === normalizedAlias || normalizedKey.includes(normalizedAlias);
    });
    if (found && hasValue(found[1])) return found[1];
  }

  return undefined;
}

function hasAnyColumnValue(columns: Record<string, unknown>, aliases: string[] = []) {
  return findColumnValue(columns, aliases) !== undefined;
}

function hasQuoteColumnValue(columns: Record<string, unknown>, aliases: string[] = []) {
  const entries = Object.entries(columns);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const found = entries.find(([key, value]) => {
      const normalizedKey = normalizeHeader(key);
      const isCostHeader = normalizedKey.includes("成本");
      return (
        !isCostHeader &&
        hasValue(value) &&
        (normalizedKey === normalizedAlias || normalizedKey.includes(normalizedAlias))
      );
    });
    if (found) return true;
  }

  return false;
}

function getPriceCandidateStatus(params: {
  hasCostCandidate: boolean;
  hasQuoteCandidate: boolean;
}): CreateQuoteSourceStagingRowInput["priceCandidateStatus"] {
  if (params.hasCostCandidate) return "cost_candidate_available";
  if (params.hasQuoteCandidate) return "quote_candidate_available";
  return "missing";
}

function getRowStatus(params: {
  standardKjCode: string;
  rawKjCode: string;
  productNameCandidate: string;
  hasPriceCandidate: boolean;
}): CreateQuoteSourceStagingRowInput["rowStatus"] {
  if (!params.standardKjCode && !params.rawKjCode) return "needs_manual_review";
  if (!params.productNameCandidate) return "needs_manual_review";
  if (!params.hasPriceCandidate) return "needs_manual_review";
  return "candidate";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function assertSupportedCondenserInput(input: QuoteSourceRowImportInput) {
  if (input.adapterId !== SUPPORTED_ADAPTER_ID || input.category !== SUPPORTED_CATEGORY) {
    throw new Error("009H row import mapper first version only supports condenser-cost-2026 / 冷凝器。");
  }
}

export function mapQuoteSourceWorkbookRowsToStagingRows(
  input: QuoteSourceRowImportInput
): CreateQuoteSourceStagingRowInput[] {
  assertSupportedCondenserInput(input);
  const mapping = mergeMappings(input.adapterId);

  return input.rows.map((row) => {
    const rawKjCode = normalizeValue(findColumnValue(row.columns, mapping.kjCode));
    const normalizedKj = normalizeKjCode(rawKjCode);
    const productNameCandidate = normalizeValue(findColumnValue(row.columns, mapping.productName));
    const modelCandidate = normalizeValue(findColumnValue(row.columns, mapping.model));
    const specificationCandidate = normalizeValue(findColumnValue(row.columns, mapping.specification));
    const oldKjNo = normalizeValue(findColumnValue(row.columns, mapping.oldCode));
    const fumacrmCode = normalizeValue(findColumnValue(row.columns, mapping.fumacrmCode));
    const dingjieCodeWithoutCap = normalizeValue(findColumnValue(row.columns, mapping.erpCode));
    const hasCostCandidate = hasAnyColumnValue(row.columns, mapping.costPrice);
    const hasQuoteCandidate = hasQuoteColumnValue(row.columns, mapping.quotePrice);
    const hasPackagingInfo = hasAnyColumnValue(row.columns, mapping.packaging);
    const hasOemInfo = hasAnyColumnValue(row.columns, mapping.oemCode);
    const hasPriceCandidate = hasCostCandidate || hasQuoteCandidate;
    const priceCandidateStatus = getPriceCandidateStatus({ hasCostCandidate, hasQuoteCandidate });
    const rowStatus = getRowStatus({
      standardKjCode: normalizedKj.standardKjCode,
      rawKjCode,
      productNameCandidate,
      hasPriceCandidate
    });
    const warnings = unique([
      PRICE_BOUNDARY_WARNING,
      EXPORT_VISIBILITY_WARNING,
      ...normalizedKj.warnings,
      !rawKjCode ? "缺少 KJ 编码，需要人工确认。" : "",
      !productNameCandidate ? "缺少产品名称，需要人工确认。" : "",
      !hasPriceCandidate ? "缺少成本 / 报价候选列，仅能进入人工确认。" : "",
      hasOemInfo ? "检测到 OEM / OE 信息，但本阶段不做 OEM 自动匹配。" : "",
      rowStatus === "candidate" ? "candidate 仍然只表示财务侧候选，不等于出口部可用。" : ""
    ]);

    return {
      batchId: input.batchId,
      sourceRowNumber: row.sourceRowNumber,
      rawKjCode: rawKjCode || undefined,
      standardKjCode: normalizedKj.standardKjCode || undefined,
      oldKjNo: oldKjNo || undefined,
      fumacrmCode: fumacrmCode || undefined,
      dingjieCodeWithoutCap: dingjieCodeWithoutCap || undefined,
      productNameCandidate: productNameCandidate || undefined,
      category: input.category,
      modelCandidate: modelCandidate || undefined,
      specificationCandidate: specificationCandidate || undefined,
      tradeMode: "unknown",
      priceCandidateStatus,
      hasCostCandidate,
      hasQuoteCandidate,
      hasPackagingInfo,
      hasOemInfo,
      visibility: "finance_only",
      rowStatus,
      warnings
    };
  });
}
