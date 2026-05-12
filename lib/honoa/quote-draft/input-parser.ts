import type { QuoteDraftInputLine, QuoteDraftRequestedCodeType } from "./types";

const QUANTITY_PATTERN = /^[\s,，*]*(?:[xX×]\s*)?(-?\d+(?:\.\d+)?)(?:\s*(?:PCS\.?|PC|件|个|套))?(?=$|[\s,，]|[^0-9.])/i;

function detectRequestedCodeType(code: string): QuoteDraftRequestedCodeType {
  const normalized = code.normalize("NFKC").trim().toUpperCase();

  if (!normalized) {
    return "unknown";
  }

  if (/^KJ[A-Z0-9_/-]*$/i.test(normalized)) {
    return "kj";
  }

  if (/^OEM[:：-]?/i.test(normalized)) {
    return "oem";
  }

  if (/^OE[:：-]?/i.test(normalized)) {
    return "oe";
  }

  if (/^\d{3,}[A-Z0-9_/-]*$/i.test(normalized)) {
    return "oem";
  }

  return "unknown";
}

function getRequestedCode(line: string) {
  const normalized = line.normalize("NFKC").trim();
  return normalized.match(/^([^\s,，*]+)/)?.[1]?.trim() ?? "";
}

function removeFirstQuantity(text: string) {
  return text
    .replace(QUANTITY_PATTERN, " ")
    .replace(/^[\s,，*xX×]+|[\s,，]+$/g, "")
    .trim();
}

export function parseQuoteDraftInput(text: string): QuoteDraftInputLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((rawInput) => {
      const requestedCode = getRequestedCode(rawInput);
      const afterCode = rawInput.normalize("NFKC").slice(rawInput.normalize("NFKC").indexOf(requestedCode) + requestedCode.length).trim();
      const quantityMatch = afterCode.match(QUANTITY_PATTERN);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : undefined;
      const customerNote = removeFirstQuantity(afterCode).replace(/^[,，]+/, "").trim() || undefined;
      const warnings: string[] = [];

      if (!requestedCode) {
        warnings.push("未识别到请求编码，需要人工确认。");
      }

      if (!quantityMatch) {
        warnings.push("缺少数量，请人工确认。");
      } else if (!Number.isFinite(quantity) || Number(quantity) <= 0) {
        warnings.push("数量异常，请输入大于 0 的数量。");
      }

      return {
        rawInput,
        requestedCode,
        requestedCodeType: detectRequestedCodeType(requestedCode),
        quantity,
        customerNote,
        warnings
      };
    });
}
