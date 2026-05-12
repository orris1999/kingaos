#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const xlsx = require("xlsx");

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

const {
  QUOTE_SOURCE_WORKBOOK_CONFIGS,
  createQuoteSourceDryRunSummaryFromMetadata,
  getQuoteSourceWorkbookConfig,
  matchQuoteSourceAdapter
} = require("../lib/honoa/quote-draft");

const USAGE = `KingaOS Finance Quote Source dry-run

Usage:
  npm run quote-source:dry-run -- --file "/path/to/报价表.xlsx"

Options:
  --file <path>     必填。只读取这个显式指定的 Excel 文件结构。
  --json            输出 JSON。
  --max-rows <n>    扫描每个 sheet 顶部 n 行寻找表头候选，默认 20。
  --help            显示帮助。

Safety:
  - 只读取 workbook 结构、sheet 名和表头候选。
  - 不会默认扫描目录，必须显式传入 --file。
  - 不输出真实价格明细，不写数据库，不导入报价表。
  - 报价表 / 成本表 / 价格候选数据未来由财务提交和维护。
  - 成本价不是财务批准价格，dry-run 不生成正式报价。`;

function parseArgs(argv) {
  const args = {
    file: null,
    json: false,
    maxRows: 20,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      args.help = true;
    } else if (token === "--json") {
      args.json = true;
    } else if (token === "--file") {
      args.file = argv[index + 1] ?? null;
      index += 1;
    } else if (token === "--max-rows") {
      const rawValue = argv[index + 1];
      const parsed = Number(rawValue);
      args.maxRows = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : 20;
      index += 1;
    } else {
      throw new Error(`未知参数：${token}`);
    }
  }

  return args;
}

function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".xls") {
    return "xls";
  }
  if (ext === ".xlsx") {
    return "xlsx";
  }
  return "unknown";
}

function normalizeHeaderCandidate(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function getAllColumnHeaderCandidates(adapterId) {
  const configs = adapterId
    ? [getQuoteSourceWorkbookConfig(adapterId)].filter(Boolean)
    : QUOTE_SOURCE_WORKBOOK_CONFIGS;
  const candidates = [];

  for (const config of configs) {
    for (const sheet of [...config.primarySheets, ...(config.auxiliarySheets ?? [])]) {
      for (const values of Object.values(sheet.columnMapping)) {
        candidates.push(...(values ?? []));
      }
    }
  }

  return new Set(candidates.map(normalizeHeaderCandidate));
}

function getCellValue(sheet, rowIndex, columnIndex) {
  const cellAddress = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = sheet[cellAddress];
  return cell?.v;
}

function extractHeaderCandidatesFromSheet(sheet, maxRows, headerVocabulary) {
  const rangeRef = sheet["!ref"];
  if (!rangeRef) {
    return { usedRange: null, headerCandidates: [] };
  }

  const range = xlsx.utils.decode_range(rangeRef);
  let bestHeaders = [];

  const lastRow = Math.min(range.e.r, range.s.r + maxRows - 1);
  for (let rowIndex = range.s.r; rowIndex <= lastRow; rowIndex += 1) {
    const rowHeaders = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const value = getCellValue(sheet, rowIndex, columnIndex);
      if (typeof value !== "string") {
        continue;
      }

      const normalized = normalizeHeaderCandidate(value);
      if (headerVocabulary.has(normalized)) {
        rowHeaders.push(String(value).normalize("NFKC").trim());
      }
    }

    if (rowHeaders.length > bestHeaders.length) {
      bestHeaders = rowHeaders;
    }
  }

  return {
    usedRange: rangeRef,
    headerCandidates: Array.from(new Set(bestHeaders))
  };
}

function extractWorkbookMetadata(filePath, maxRows) {
  if (!filePath) {
    throw new Error("必须显式传入 --file。CLI 不会默认扫描目录。");
  }
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在：${filePath}`);
  }

  const fileStat = statSync(filePath);
  if (!fileStat.isFile()) {
    throw new Error("--file 必须指向单个 Excel 文件，不能传目录。");
  }

  const sourceFileName = path.basename(filePath);
  const fileType = getFileType(filePath);
  const workbook = xlsx.readFile(filePath, {
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    bookVBA: false
  });
  const detectedSheets = workbook.SheetNames;
  const adapterMatch = matchQuoteSourceAdapter({ sourceFileName, fileType, detectedSheets });
  const headerVocabulary = getAllColumnHeaderCandidates(adapterMatch.adapterId);
  const detectedHeadersBySheet = {};
  const sheetSummaries = [];

  for (const sheetName of detectedSheets) {
    const sheet = workbook.Sheets[sheetName];
    const sheetSummary = extractHeaderCandidatesFromSheet(sheet, maxRows, headerVocabulary);
    detectedHeadersBySheet[sheetName] = sheetSummary.headerCandidates;
    sheetSummaries.push({
      sheetName,
      usedRange: sheetSummary.usedRange,
      headerCandidates: sheetSummary.headerCandidates
    });
  }

  return {
    metadata: {
      sourceFileName,
      fileType,
      detectedSheets,
      detectedHeadersBySheet
    },
    sheetSummaries
  };
}

function createSafeDryRunOutput(filePath, maxRows) {
  const { metadata, sheetSummaries } = extractWorkbookMetadata(filePath, maxRows);
  const adapterMatch = matchQuoteSourceAdapter(metadata);
  const dryRunSummary = createQuoteSourceDryRunSummaryFromMetadata(metadata);
  const hasCostCandidate = Boolean(dryRunSummary.mappedColumns.costPrice?.length);
  const hasQuoteCandidate = Boolean(dryRunSummary.mappedColumns.quotePrice?.length);

  return {
    dryRunKind: "finance_quote_source_structure_only",
    safetyNotice: [
      "本 dry-run 只读取显式指定 Excel 文件的结构。",
      "不输出真实价格明细，不写数据库，不导入报价表，不生成报价草稿或正式报价。",
      "报价表 / 成本表 / 价格候选数据未来由财务提交和维护，出口部不能上传或维护报价表。",
      "成本价不是财务批准价格，正式报价必须后续接 FinancePricing。"
    ],
    sourceFileName: metadata.sourceFileName,
    fileType: metadata.fileType,
    sheetCount: metadata.detectedSheets.length,
    sheetSummaries,
    adapterMatch,
    dryRunSummary,
    priceColumnDetection: {
      hasCostCandidate,
      hasQuoteCandidate
    },
    rowSampleShape: {
      hasKjCode: Boolean(
        dryRunSummary.mappedColumns.kjCode?.length ||
          dryRunSummary.mappedColumns.oldCode?.length ||
          dryRunSummary.mappedColumns.erpCode?.length ||
          dryRunSummary.mappedColumns.fumacrmCode?.length
      ),
      hasOemCode: Boolean(dryRunSummary.mappedColumns.oemCode?.length),
      hasCostCandidate,
      hasQuoteCandidate
    },
    sideEffects: {
      readsExplicitFileOnly: true,
      scansDirectory: false,
      writesDatabase: false,
      importsToProduction: false,
      uploadsFile: false,
      generatesQuoteDraft: false,
      generatesOfficialQuote: false
    }
  };
}

function formatHumanOutput(output) {
  const lines = [
    "KingaOS Finance Quote Source dry-run",
    "本脚本只输出结构摘要，不输出真实价格明细，不写数据库，不生成正式报价。",
    `文件名：${output.sourceFileName}`,
    `文件类型：${output.fileType}`,
    `Sheet 数量：${output.sheetCount}`,
    `Adapter：${output.adapterMatch.adapterId ?? "未匹配"} (${output.adapterMatch.confidence})`,
    `submittedByRole：${output.dryRunSummary.submittedByRole}`,
    `consumerDepartment：${output.dryRunSummary.consumerDepartment}`,
    `检测到成本候选列：${output.priceColumnDetection.hasCostCandidate ? "是" : "否"}`,
    `检测到报价候选列：${output.priceColumnDetection.hasQuoteCandidate ? "是" : "否"}`,
    "",
    "Sheets："
  ];

  for (const sheet of output.sheetSummaries) {
    lines.push(`- ${sheet.sheetName} (${sheet.usedRange ?? "空范围"})`);
    lines.push(`  表头候选：${sheet.headerCandidates.length > 0 ? sheet.headerCandidates.join(" / ") : "未识别"}`);
  }

  lines.push("", "Mapped columns：", JSON.stringify(output.dryRunSummary.mappedColumns, null, 2));
  lines.push("", "Warnings：");
  for (const warning of output.dryRunSummary.warnings) {
    lines.push(`- ${warning}`);
  }

  if (output.dryRunSummary.unsupportedReasons.length > 0) {
    lines.push("", "Unsupported reasons：");
    for (const reason of output.dryRunSummary.unsupportedReasons) {
      lines.push(`- ${reason}`);
    }
  }

  return lines.join("\n");
}

function runCli(argv) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const output = createSafeDryRunOutput(args.file, args.maxRows);
  console.log(args.json ? JSON.stringify(output, null, 2) : formatHumanOutput(output));
  return 0;
}

export {
  createSafeDryRunOutput,
  extractWorkbookMetadata,
  formatHumanOutput,
  parseArgs,
  runCli
};

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(USAGE);
    process.exitCode = 1;
  }
}
