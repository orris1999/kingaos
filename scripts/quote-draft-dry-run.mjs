#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  module._compile(output, filename);
};

const { generateQuoteDraftCandidates, parseQuoteDraftInput } = require("../lib/honoa/quote-draft");

const mockCatalog = [
  {
    kjCode: "KJ12345",
    productName: "Radiator",
    category: "水箱",
    oemCodes: ["16400-XXX"],
    imageStatus: "available",
    imageRef: "mock://kj12345-main",
    unit: "pcs",
    priceCandidate: {
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
    kjCode: "KJ-DUP-001",
    productName: "Duplicate A",
    category: "冷凝器",
    imageStatus: "embedded_only"
  },
  {
    kjCode: "KJ-DUP-001",
    productName: "Duplicate B",
    category: "冷凝器",
    imageStatus: "available"
  }
];

const mockInput = [
  "KJ12345 100 pcs",
  "KJ67890",
  "KJ-DUP-001 x 20",
  "KJ404，5，客户要中性包装",
  "16400-XXXXX 300"
].join("\n");

const inputLines = parseQuoteDraftInput(mockInput);
const candidates = generateQuoteDraftCandidates(inputLines, mockCatalog);

console.log("KingaOS Quote Draft dry-run");
console.log("本脚本只使用 mock 数据，不读取报价表，不写数据库，不调用生产环境。");
console.log("输出结果只是报价草稿候选，不是正式报价。");
console.log("priceCandidate 不是财务批准价格，正式报价前必须接 FinancePricing。");
console.log(
  JSON.stringify(
    {
      inputLines,
      candidates
    },
    null,
    2
  )
);
