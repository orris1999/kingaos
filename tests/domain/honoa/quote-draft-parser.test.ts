import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  generateQuoteDraftCandidates,
  normalizeKjCode,
  parseQuoteDraftInput
} from "@/lib/honoa/quote-draft";
import type { QuoteDraftCatalogItem } from "@/lib/honoa/quote-draft";

const mockCatalog: QuoteDraftCatalogItem[] = [
  {
    kjCode: "KJ12345",
    productName: "Radiator",
    category: "水箱",
    oemCodes: ["16400-XXX"],
    imageStatus: "available",
    imageRef: "mock://kj12345-main",
    unit: "pcs",
    priceCandidate: {
      amount: 12.5,
      currency: "USD",
      sourceType: "cost_candidate",
      sourceFile: "mock-cost-table",
      sourceSheet: "mock-sheet",
      sourceRow: 10
    }
  },
  {
    kjCode: "KJ67890",
    productName: "Heater",
    category: "暖风",
    imageStatus: "missing",
    unit: "pcs"
  },
  {
    kjCode: "KJ-EMBED-001",
    productName: "Condenser",
    category: "冷凝器",
    imageStatus: "embedded_only",
    unit: "pcs",
    priceCandidate: {
      amount: 20,
      currency: "USD",
      sourceType: "quote_candidate",
      sourceFile: "mock-quote-table",
      sourceSheet: "mock-sheet",
      sourceRow: 11
    }
  }
];

describe("Quote Task 001B KJ 报价草稿解析器纯内存原型", () => {
  it("normalizeKjCode 会 trim / NFKC / 大写并保留必要连接符", () => {
    const result = normalizeKjCode("  ｋｊ-abc_001  ");

    expect(result.rawKjCode).toBe("  ｋｊ-abc_001  ");
    expect(result.standardKjCode).toBe("KJ-ABC_001");
    expect(result.sourceCodeType).toBe("standard_kj");
    expect(result.warnings).toContain("KJ 已按系统规则规范化。");
  });

  it("parseQuoteDraftInput 能解析 KJ 和数量", () => {
    const [line] = parseQuoteDraftInput("KJ12345 100pcs");

    expect(line).toMatchObject({
      rawInput: "KJ12345 100pcs",
      requestedCode: "KJ12345",
      requestedCodeType: "kj",
      quantity: 100
    });
  });

  it("parseQuoteDraftInput 支持 KJ12345 100 pcs", () => {
    const [line] = parseQuoteDraftInput("KJ12345 100 pcs");

    expect(line.requestedCode).toBe("KJ12345");
    expect(line.quantity).toBe(100);
    expect(line.warnings).toEqual([]);
  });

  it("parseQuoteDraftInput 支持 KJ12345*100", () => {
    const [line] = parseQuoteDraftInput("KJ12345*100");

    expect(line.requestedCode).toBe("KJ12345");
    expect(line.quantity).toBe(100);
  });

  it("parseQuoteDraftInput 支持 KJ12345 x 100", () => {
    const [line] = parseQuoteDraftInput("KJ12345 x 100");

    expect(line.requestedCode).toBe("KJ12345");
    expect(line.quantity).toBe(100);
  });

  it("parseQuoteDraftInput 支持中文逗号", () => {
    const [line] = parseQuoteDraftInput("KJ12345，100，客户要求打托");

    expect(line.requestedCode).toBe("KJ12345");
    expect(line.quantity).toBe(100);
    expect(line.customerNote).toBe("客户要求打托");
  });

  it("parseQuoteDraftInput 能保留客户备注", () => {
    const [line] = parseQuoteDraftInput("KJ-ABC-001, 50, 客户要中性包装");

    expect(line.requestedCode).toBe("KJ-ABC-001");
    expect(line.quantity).toBe(50);
    expect(line.customerNote).toBe("客户要中性包装");
  });

  it("parseQuoteDraftInput 支持空格分隔备注", () => {
    const [line] = parseQuoteDraftInput("KJ-ABC-001 50 客户要中性包装");

    expect(line.requestedCode).toBe("KJ-ABC-001");
    expect(line.quantity).toBe(50);
    expect(line.customerNote).toBe("客户要中性包装");
  });

  it("没有数量时保留输入并加 warning", () => {
    const [line] = parseQuoteDraftInput("KJ12345");
    const [candidate] = generateQuoteDraftCandidates([line], mockCatalog);

    expect(line.rawInput).toBe("KJ12345");
    expect(line.quantity).toBeUndefined();
    expect(line.warnings).toContain("缺少数量，请人工确认。");
    expect(candidate.warnings).toContain("缺少数量，请人工确认。");
  });

  it("数量为 0 时加 warning", () => {
    const [line] = parseQuoteDraftInput("KJ12345 0");

    expect(line.quantity).toBe(0);
    expect(line.warnings).toContain("数量异常，请输入大于 0 的数量。");
  });

  it("数量为负数时加 warning", () => {
    const [line] = parseQuoteDraftInput("KJ12345 -5");

    expect(line.quantity).toBe(-5);
    expect(line.warnings).toContain("数量异常，请输入大于 0 的数量。");
  });

  it("KJ 精确匹配返回 matched_by_kj", () => {
    const lines = parseQuoteDraftInput("KJ12345 100");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.kjCode).toBe("KJ12345");
    expect(candidate.productName).toBe("Radiator");
  });

  it("KJ 规范化后仍能匹配", () => {
    const lines = parseQuoteDraftInput("  ｋｊ１２３４５  10");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.kjCode).toBe("KJ12345");
    expect(candidate.warnings).toContain("KJ 已按系统规则规范化。");
  });

  it("KJ 找不到返回 kj_not_found", () => {
    const lines = parseQuoteDraftInput("KJ404 1");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidate.matchStatus).toBe("kj_not_found");
    expect(candidate.priceStatus).toBe("missing");
  });

  it("KJ 重复返回 ambiguous_kj", () => {
    const duplicatedCatalog: QuoteDraftCatalogItem[] = [
      { kjCode: "KJ-DUP-001", productName: "A", imageStatus: "available" },
      { kjCode: "KJ-DUP-001", productName: "B", imageStatus: "available" }
    ];
    const lines = parseQuoteDraftInput("KJ-DUP-001 1");
    const [candidate] = generateQuoteDraftCandidates(lines, duplicatedCatalog);

    expect(candidate.matchStatus).toBe("ambiguous_kj");
    expect(candidate.priceStatus).toBe("requires_finance_review");
  });

  it("OEM 输入返回 oem_not_supported_yet", () => {
    const lines = parseQuoteDraftInput("16400-XXXXX 300");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(lines[0].requestedCodeType).toBe("oem");
    expect(candidate.matchStatus).toBe("oem_not_supported_yet");
    expect(candidate.imageStatus).toBe("not_supported_yet");
  });

  it("unknown 输入返回 requires_technical_review", () => {
    const lines = parseQuoteDraftInput("ABC-UNKNOWN 10");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(lines[0].requestedCodeType).toBe("unknown");
    expect(candidate.matchStatus).toBe("requires_technical_review");
    expect(candidate.warnings).toContain("输入编码类型不明确，需要技术确认。");
  });

  it("无图片返回 imageStatus = missing", () => {
    const lines = parseQuoteDraftInput("KJ67890 2");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidate.matchStatus).toBe("matched_by_kj");
    expect(candidate.imageStatus).toBe("missing");
    expect(candidate.warnings).toContain("未找到稳定产品图片。");
  });

  it("Excel 嵌入图返回 imageStatus = embedded_only", () => {
    const lines = parseQuoteDraftInput("KJ-EMBED-001 2");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidate.imageStatus).toBe("embedded_only");
    expect(candidate.warnings).toContain("仅检测到 Excel 嵌入图，未归档为稳定主图。");
  });

  it("无价格返回 priceStatus = missing", () => {
    const lines = parseQuoteDraftInput("KJ67890 2");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidate.priceStatus).toBe("missing");
    expect(candidate.warnings).toContain("未找到价格候选，需要人工确认。");
  });

  it("成本候选价格会被标记为非财务批准价格", () => {
    const lines = parseQuoteDraftInput("KJ12345 2");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);
    const forbiddenKey = "finance" + "Approved" + "Price";

    expect(candidate.priceStatus).toBe("not_finance_approved");
    expect(candidate.priceCandidate?.sourceType).toBe("cost_candidate");
    expect(candidate.warnings.join("\n")).toContain("不是财务批准价格");
    expect(Object.prototype.hasOwnProperty.call(candidate, forbiddenKey)).toBe(false);
  });

  it("warnings 不包含真实价格金额", () => {
    const lines = parseQuoteDraftInput("KJ12345 2");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidate.warnings.join("\n")).not.toContain("12.5");
  });

  it("输出 DTO 不包含正式报价或发送客户状态", () => {
    const lines = parseQuoteDraftInput("KJ12345 2");
    const [candidate] = generateQuoteDraftCandidates(lines, mockCatalog);
    const serialized = JSON.stringify(candidate);

    expect(serialized).not.toContain(["sent", "to", "customer"].join("_"));
    expect(serialized).not.toContain("official" + "Quote");
  });

  it("dry-run 脚本不读 Excel、不写数据库", () => {
    const script = readFileSync("scripts/quote-draft-dry-run.mjs", "utf8");

    expect(script).not.toContain(".xlsx");
    expect(script).not.toContain(".xls");
    expect(script).not.toContain("PrismaClient");
    expect(script).not.toContain("DATABASE_URL");
    expect(script).not.toContain("prisma.");
  });

  it("纯内存 parser 不需要数据库即可运行", () => {
    const lines = parseQuoteDraftInput(["KJ12345 1", "KJ67890 2"].join("\n"));
    const candidates = generateQuoteDraftCandidates(lines, mockCatalog);

    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.lineNo)).toEqual([1, 2]);
  });
});
