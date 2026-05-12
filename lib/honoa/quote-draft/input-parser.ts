import type { QuoteDraftInputLine, QuoteDraftRequestedCodeType } from "./types";

const QUANTITY_PATTERN = /(?:^|[\s,，])(\d+(?:\.\d+)?)(?:\s*(?:PCS|PCS\.|PC|件|个|套))?(?=$|[\s,，])/i;

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
  const firstSegment = line.split(/[,\uFF0C]/)[0]?.trim() ?? "";
  return firstSegment.split(/\s+/)[0]?.trim() ?? "";
}

function removeFirstQuantity(text: string) {
  return text.replace(QUANTITY_PATTERN, " ").replace(/^[\s,，]+|[\s,，]+$/g, "").trim();
}

export function parseQuoteDraftInput(text: string): QuoteDraftInputLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((rawInput) => {
      const requestedCode = getRequestedCode(rawInput);
      const quantityMatch = rawInput.match(QUANTITY_PATTERN);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : undefined;
      const afterCode = rawInput.slice(rawInput.indexOf(requestedCode) + requestedCode.length).trim();
      const customerNote = removeFirstQuantity(afterCode).replace(/^[,，]+/, "").trim() || undefined;

      return {
        rawInput,
        requestedCode,
        requestedCodeType: detectRequestedCodeType(requestedCode),
        quantity,
        customerNote
      };
    });
}

