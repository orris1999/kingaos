import type { NormalizedKjCode, SourceCodeType } from "./types";

const KJ_CODE_PATTERN = /KJ[A-Z0-9_/-]*/g;
const GENERIC_CODE_PATTERN = /[A-Z0-9][A-Z0-9_/-]*/g;

function detectSourceCodeType(value: string): SourceCodeType {
  if (!value) {
    return "unknown_code";
  }

  if (/ERP|鼎捷/.test(value)) {
    return "erp_code";
  }

  if (/孚盟|FUMA|CRM/.test(value)) {
    return "fumacrm_code";
  }

  if (/旧|原KJ|OLD/.test(value)) {
    return "old_code";
  }

  if (/KJ/.test(value)) {
    return "standard_kj";
  }

  return "unknown_code";
}

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().toUpperCase();
}

function sanitizeCodeToken(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_/-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[\-_\/]+|[\-_\/]+$/g, "");
}

function chooseBestToken(value: string) {
  const withoutSpaces = value.replace(/\s+/g, "");
  const kjCandidates = Array.from(withoutSpaces.matchAll(KJ_CODE_PATTERN))
    .map((match) => sanitizeCodeToken(match[0]))
    .filter((token) => /[0-9]/.test(token) && token.length > 2);

  if (kjCandidates.length > 0) {
    return kjCandidates.sort((a, b) => b.length - a.length)[0];
  }

  const genericCandidates = Array.from(withoutSpaces.matchAll(GENERIC_CODE_PATTERN))
    .map((match) => sanitizeCodeToken(match[0]))
    .filter((token) => /[0-9]/.test(token));

  return genericCandidates.sort((a, b) => b.length - a.length)[0] ?? "";
}

export function normalizeKjCode(input: string): NormalizedKjCode {
  const rawKjCode = input;
  const normalizedText = normalizeText(input);
  const warnings: string[] = [];

  if (!normalizedText) {
    return {
      rawKjCode,
      standardKjCode: "",
      sourceCodeType: "unknown_code",
      warnings: ["KJ 输入为空，无法匹配。"]
    };
  }

  const standardKjCode = chooseBestToken(normalizedText);
  const sourceCodeType = detectSourceCodeType(normalizedText);

  if (!standardKjCode) {
    warnings.push("未识别到可用于 KJ 匹配的编码。");
  }

  if (standardKjCode && standardKjCode !== input.trim()) {
    warnings.push("KJ 已按系统规则规范化。");
  }

  if (sourceCodeType === "unknown_code") {
    warnings.push("编码来源不明确，需要人工确认。");
  }

  return {
    rawKjCode,
    standardKjCode,
    sourceCodeType,
    warnings
  };
}

