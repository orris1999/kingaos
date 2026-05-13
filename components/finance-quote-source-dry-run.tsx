"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import {
  createQuoteSourceDryRunSummaryFromMetadata,
  matchQuoteSourceAdapter
} from "@/lib/honoa/quote-draft/source-adapter-matcher";
import type {
  QuoteSourceAdapterMatchResult,
  QuoteSourceDryRunSummary,
  QuoteSourceWorkbookMetadata,
  QuoteSourceWorkbookMetadataFileType
} from "@/lib/honoa/quote-draft/source-adapter-types";

type DryRunResult = {
  metadata: QuoteSourceWorkbookMetadata;
  matchResult: QuoteSourceAdapterMatchResult;
  summary: QuoteSourceDryRunSummary;
};

const PRICE_BOUNDARY_NOTICE = "检测到的价格字段只作为 priceCandidate / costCandidate 候选，不是财务批准价格。";

function getFileType(fileName: string): QuoteSourceWorkbookMetadataFileType {
  const normalized = fileName.normalize("NFKC").toLowerCase();
  if (normalized.endsWith(".xlsx")) {
    return "xlsx";
  }
  if (normalized.endsWith(".xls")) {
    return "xls";
  }
  return "unknown";
}

function normalizeHeaderCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isHeaderCandidate(value: string) {
  if (!value) {
    return false;
  }

  if (/^[\d.,，%￥$€£\s-]+$/.test(value)) {
    return false;
  }

  return /[\p{Script=Han}A-Za-z]/u.test(value);
}

function getHeaderCandidates(rows: unknown[][]) {
  for (const row of rows.slice(0, 20)) {
    const headers = Array.from(new Set(row.map(normalizeHeaderCell).filter(isHeaderCandidate)));
    if (headers.length >= 2) {
      return headers;
    }
  }

  const firstRow = rows[0] ?? [];
  return Array.from(new Set(firstRow.map(normalizeHeaderCell).filter(isHeaderCandidate)));
}

async function extractWorkbookMetadata(file: File): Promise<QuoteSourceWorkbookMetadata> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    sheetRows: 20,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false
  });

  const detectedHeadersBySheet: Record<string, string[]> = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false
    }) as unknown[][];

    detectedHeadersBySheet[sheetName] = getHeaderCandidates(rows);
  }

  return {
    sourceFileName: file.name,
    fileType: getFileType(file.name),
    detectedSheets: workbook.SheetNames,
    detectedHeadersBySheet
  };
}

function hasMappedColumn(summary: QuoteSourceDryRunSummary, keys: string[]) {
  return keys.some((key) => (summary.mappedColumns[key] ?? []).length > 0);
}

function BooleanSignal({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="card">
      <span className="muted">{label}</span>
      <strong>{value ? "是" : "否"}</strong>
    </div>
  );
}

export function FinanceQuoteSourceDryRun() {
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const detectedSignals = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      kj: hasMappedColumn(result.summary, ["kjCode", "oldCode", "erpCode", "fumacrmCode"]),
      oem: hasMappedColumn(result.summary, ["oemCode"]),
      productName: hasMappedColumn(result.summary, ["productName", "model"]),
      costPrice: hasMappedColumn(result.summary, ["costPrice"]),
      quotePrice: hasMappedColumn(result.summary, ["quotePrice"]),
      packaging: hasMappedColumn(result.summary, ["packaging"])
    };
  }, [result]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    setResult(null);

    if (!file) {
      return;
    }

    try {
      setIsReading(true);
      const metadata = await extractWorkbookMetadata(file);
      const matchResult = matchQuoteSourceAdapter(metadata);
      const summary = createQuoteSourceDryRunSummaryFromMetadata(metadata);
      setResult({ metadata, matchResult, summary });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取本地 Excel 结构失败。");
    } finally {
      setIsReading(false);
    }
  }

  return (
    <section className="stack" data-testid="finance-quote-source-dry-run">
      <div className="notice warn-notice stack">
        <h2>Finance 报价表 dry-run</h2>
        <p>本页面只做本地结构识别，不上传文件，不写数据库。</p>
        <p>报价表 / 成本表 / 价格候选数据由财务提交和维护。</p>
        <p>出口部不能上传或维护价格表。</p>
        <p>dry-run 不生成报价草稿，不生成正式报价。</p>
        <p>{PRICE_BOUNDARY_NOTICE}</p>
      </div>

      <div className="panel stack">
        <div>
          <h2>选择本地报价表</h2>
          <p className="muted">仅支持手动选择单个 .xls / .xlsx 文件。浏览器只读取前 20 行结构用于识别表头。</p>
        </div>
        <label className="field">
          <span>本地 Excel 文件</span>
          <input
            data-testid="quote-source-local-file-input"
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
          />
        </label>
        {isReading ? <p className="muted">正在本地识别结构...</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>

      {result && detectedSignals ? (
        <div className="stack" data-testid="quote-source-dry-run-summary">
          <div className="panel stack">
            <div>
              <h2>结构识别摘要</h2>
              <p className="muted">以下仅为结构和字段映射结果，不包含任何具体价格金额或产品行明细。</p>
            </div>
            <div className="grid">
              <BooleanSignal label="检测到 KJ 列" value={detectedSignals.kj} />
              <BooleanSignal label="检测到 OEM / OE 列" value={detectedSignals.oem} />
              <BooleanSignal label="检测到产品名称列" value={detectedSignals.productName} />
              <BooleanSignal label="检测到成本候选列" value={detectedSignals.costPrice} />
              <BooleanSignal label="检测到报价候选列" value={detectedSignals.quotePrice} />
              <BooleanSignal label="检测到包装列" value={detectedSignals.packaging} />
            </div>
          </div>

          <div className="panel stack">
            <h2>Adapter 匹配结果</h2>
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <th>文件名</th>
                    <td>{result.summary.sourceFileName}</td>
                  </tr>
                  <tr>
                    <th>文件类型</th>
                    <td>{result.metadata.fileType}</td>
                  </tr>
                  <tr>
                    <th>Sheet 数量</th>
                    <td>{result.summary.detectedSheets.length}</td>
                  </tr>
                  <tr>
                    <th>Sheet 名称</th>
                    <td>{result.summary.detectedSheets.join(" / ") || "未识别"}</td>
                  </tr>
                  <tr>
                    <th>adapterId</th>
                    <td>{result.summary.adapterId}</td>
                  </tr>
                  <tr>
                    <th>匹配置信度</th>
                    <td>{result.matchResult.confidence}</td>
                  </tr>
                  <tr>
                    <th>submittedByRole</th>
                    <td>{result.summary.submittedByRole}</td>
                  </tr>
                  <tr>
                    <th>consumerDepartment</th>
                    <td>{result.summary.consumerDepartment}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel stack">
            <h2>字段映射</h2>
            {Object.keys(result.summary.mappedColumns).length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>命中的表头候选</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.summary.mappedColumns).map(([fieldKey, headers]) => (
                      <tr key={fieldKey}>
                        <td>{fieldKey}</td>
                        <td>{headers.join(" / ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">暂无字段映射命中。</p>
            )}
          </div>

          <div className="panel stack">
            <h2>表头候选</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>表头候选</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.metadata.detectedHeadersBySheet ?? {}).map(([sheetName, headers]) => (
                    <tr key={sheetName}>
                      <td>{sheetName}</td>
                      <td>{headers.join(" / ") || "未识别"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel stack">
            <h2>Warnings</h2>
            <ul>
              {result.summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>

          {result.summary.unsupportedReasons.length > 0 ? (
            <div className="panel stack">
              <h2>Unsupported Reasons</h2>
              <ul>
                {result.summary.unsupportedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
