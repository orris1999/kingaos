import { normalizeKjCode } from "./normalize";
import type {
  QuoteDraftCatalogItem,
  QuoteDraftImageStatus,
  QuoteDraftInputLine,
  QuoteDraftLineCandidate,
  QuoteDraftPriceStatus
} from "./types";

function getPriceStatus(item: QuoteDraftCatalogItem): {
  priceStatus: QuoteDraftPriceStatus;
  warnings: string[];
} {
  if (!item.priceCandidate) {
    return {
      priceStatus: "missing",
      warnings: ["未找到价格候选，需要人工确认。"]
    };
  }

  if (item.priceCandidate.sourceType === "cost_candidate") {
    return {
      priceStatus: "not_finance_approved",
      warnings: ["价格只是成本候选，不是财务批准价格，正式报价前必须财务确认。"]
    };
  }

  if (item.priceCandidate.sourceType === "quote_candidate") {
    return {
      priceStatus: "candidate_quote_available",
      warnings: ["价格只是报价候选，正式报价前仍需财务确认。"]
    };
  }

  return {
    priceStatus: "requires_finance_review",
    warnings: ["价格字段性质不明确，需要财务确认。"]
  };
}

function getImageStatus(item: QuoteDraftCatalogItem): {
  imageStatus: QuoteDraftImageStatus;
  warnings: string[];
} {
  const imageStatus = item.imageStatus ?? "missing";

  if (imageStatus === "missing") {
    return { imageStatus, warnings: ["未找到稳定产品图片。"] };
  }

  if (imageStatus === "embedded_only") {
    return { imageStatus, warnings: ["仅检测到 Excel 嵌入图，未归档为稳定主图。"] };
  }

  return { imageStatus, warnings: [] };
}

function buildCatalogIndex(catalog: QuoteDraftCatalogItem[]) {
  const index = new Map<string, QuoteDraftCatalogItem[]>();

  for (const item of catalog) {
    const normalized = normalizeKjCode(item.kjCode);
    if (!normalized.standardKjCode) {
      continue;
    }
    const existing = index.get(normalized.standardKjCode) ?? [];
    existing.push(item);
    index.set(normalized.standardKjCode, existing);
  }

  return index;
}

function unsupportedCodeCandidate(line: QuoteDraftInputLine, lineNo: number): QuoteDraftLineCandidate {
  return {
    lineNo,
    rawInput: line.rawInput,
    matchStatus: "oem_not_supported_yet",
    imageStatus: "not_supported_yet",
    quantity: line.quantity,
    priceStatus: "missing",
    warnings: [...line.warnings, "OEM / OE 自动匹配暂未开放，请提供 KJ 或进入人工匹配。"]
  };
}

export function generateQuoteDraftCandidates(
  inputLines: QuoteDraftInputLine[],
  catalog: QuoteDraftCatalogItem[]
): QuoteDraftLineCandidate[] {
  const catalogIndex = buildCatalogIndex(catalog);

  return inputLines.map((line, index) => {
    const lineNo = index + 1;

    if (line.requestedCodeType === "oem" || line.requestedCodeType === "oe") {
      return unsupportedCodeCandidate(line, lineNo);
    }

    if (line.requestedCodeType !== "kj") {
      return {
        lineNo,
        rawInput: line.rawInput,
        matchStatus: "requires_technical_review",
        imageStatus: "not_supported_yet",
        quantity: line.quantity,
        priceStatus: "missing",
        warnings: [...line.warnings, "输入编码类型不明确，需要技术确认。"]
      };
    }

    const normalized = normalizeKjCode(line.requestedCode);
    const matches = normalized.standardKjCode ? catalogIndex.get(normalized.standardKjCode) ?? [] : [];

    if (matches.length === 0) {
      return {
        lineNo,
        rawInput: line.rawInput,
        matchStatus: "kj_not_found",
        rawKjCode: normalized.rawKjCode,
        sourceCodeType: normalized.sourceCodeType,
        imageStatus: "missing",
        quantity: line.quantity,
        priceStatus: "missing",
        warnings: [...line.warnings, ...normalized.warnings, "KJ 未找到，请检查编码或提交人工确认。"]
      };
    }

    if (matches.length > 1) {
      return {
        lineNo,
        rawInput: line.rawInput,
        matchStatus: "ambiguous_kj",
        kjCode: normalized.standardKjCode,
        rawKjCode: normalized.rawKjCode,
        sourceCodeType: normalized.sourceCodeType,
        imageStatus: "not_supported_yet",
        quantity: line.quantity,
        priceStatus: "requires_finance_review",
        warnings: [...line.warnings, ...normalized.warnings, "KJ 匹配多个候选，请人工选择。"]
      };
    }

    const item = matches[0];
    const itemNormalized = normalizeKjCode(item.kjCode);
    const image = getImageStatus(item);
    const price = getPriceStatus(item);

    return {
      lineNo,
      rawInput: line.rawInput,
      matchStatus: "matched_by_kj",
      kjCode: itemNormalized.standardKjCode,
      rawKjCode: item.rawKjCode ?? item.kjCode,
      sourceCodeType: item.sourceCodeType ?? itemNormalized.sourceCodeType,
      productName: item.productName,
      category: item.category,
      oemCodes: item.oemCodes,
      imageStatus: image.imageStatus,
      imageRef: item.imageRef,
      quantity: line.quantity,
      unit: item.unit,
      priceStatus: price.priceStatus,
      priceCandidate: item.priceCandidate,
      warnings: [...line.warnings, ...normalized.warnings, ...(item.warnings ?? []), ...image.warnings, ...price.warnings]
    };
  });
}
