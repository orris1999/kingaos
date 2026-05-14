"use client";

import { useMemo, useState } from "react";
import {
  buildExportQuoteDraftExcelFileName,
  buildExportQuoteDraftPreviewLines,
  buildExportQuoteDraftWorkbookRows,
  parseQuoteDraftInput,
  QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT,
  summarizeExportQuoteDraftPreviewLines
} from "@/lib/honoa/quote-draft";
import type {
  ExportQuoteDraftPreviewLine,
  ExportQuoteDraftPreviewActionItem,
  ExportQuoteDraftPreviewSourceMode,
  ExportQuoteDraftPreviewStatus,
  ExportQuoteDraftPreviewTradeMode,
  ExportQuoteDraftSourceCandidate,
  FindExportQuoteDraftSourceCandidatesInput
} from "@/lib/honoa/quote-draft";

const TRADE_MODE_LABELS: Record<ExportQuoteDraftPreviewTradeMode, string> = {
  export_usd: "外销 USD",
  domestic_cny: "内销 CNY",
  unknown: "未指定"
};

const SOURCE_MODE_LABELS: Record<ExportQuoteDraftPreviewSourceMode, string> = {
  mock: "Mock 数据",
  finance_confirmed_staging: "财务确认 staging 候选"
};

const PREVIEW_STATUS_LABELS: Record<ExportQuoteDraftPreviewStatus, string> = {
  ready_for_draft_preview: "可生成草稿预览",
  not_found: "未找到候选",
  multiple_candidates: "多候选，需选择",
  manual_review_required: "需人工确认",
  unsupported_oem: "OEM 暂未开放",
  missing_quantity: "缺少数量",
  staging_disabled: "staging 数据源未开放",
  error: "错误"
};

const PRICE_CANDIDATE_STATUS_LABELS: Record<string, string> = {
  cost_candidate_available: "成本候选",
  quote_candidate_available: "报价候选",
  not_finance_approved: "非财务批准价格，仅草稿候选",
  missing: "无价格候选",
  requires_finance_review: "需财务确认"
};

type FindStagingCandidatesAction = (
  input: FindExportQuoteDraftSourceCandidatesInput
) => Promise<ExportQuoteDraftSourceCandidate[]>;

type QuoteDraftWorkbenchProps = {
  stagingCandidatesEnabled?: boolean;
  excelExportEnabled?: boolean;
  isExportManagerTrial?: boolean;
  findStagingCandidatesAction?: FindStagingCandidatesAction;
};

const INITIAL_TRADE_MODE: ExportQuoteDraftPreviewTradeMode = "unknown";

function buildInitialPreviewLines() {
  return buildExportQuoteDraftPreviewLines({
    inputText: QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT,
    tradeMode: INITIAL_TRADE_MODE,
    sourceMode: "mock"
  });
}

function isStagingSource(source: ExportQuoteDraftPreviewSourceMode) {
  return source === "finance_confirmed_staging";
}

function previewStatusClass(status: ExportQuoteDraftPreviewStatus) {
  if (status === "ready_for_draft_preview") return "tag ok";
  if (status === "not_found" || status === "error") return "tag danger";
  if (status === "multiple_candidates" || status === "manual_review_required" || status === "missing_quantity") {
    return "tag warn";
  }
  return "tag";
}

function priceCandidateStatusLabel(status?: string) {
  if (!status) return "-";
  return PRICE_CANDIDATE_STATUS_LABELS[status] ?? status;
}

function actionItemClass(item: ExportQuoteDraftPreviewActionItem) {
  if (item.severity === "danger") return "tag danger";
  if (item.severity === "warning") return "tag warn";
  return "tag";
}

function warningTagClass(warning: string) {
  if (/未找到|错误|不能直接发客户/.test(warning)) return "tag danger";
  if (/缺少数量|多候选|人工|财务批准|需|风险|确认/.test(warning)) return "tag warn";
  return "tag";
}

function shortText(value?: string, maxLength = 32) {
  if (!value) return "-";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function QuoteDraftWorkbench({
  stagingCandidatesEnabled = false,
  excelExportEnabled = false,
  isExportManagerTrial = false,
  findStagingCandidatesAction
}: QuoteDraftWorkbenchProps) {
  const [input, setInput] = useState(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
  const [submittedInput, setSubmittedInput] = useState(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
  const [tradeMode, setTradeMode] = useState<ExportQuoteDraftPreviewTradeMode>(INITIAL_TRADE_MODE);
  const [sourceMode, setSourceMode] = useState<ExportQuoteDraftPreviewSourceMode>("mock");
  const [previewLines, setPreviewLines] = useState<ExportQuoteDraftPreviewLine[]>(buildInitialPreviewLines);
  const [isStagingLookupPending, setIsStagingLookupPending] = useState(false);
  const [isExcelExportPending, setIsExcelExportPending] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const effectiveSourceMode: ExportQuoteDraftPreviewSourceMode =
    stagingCandidatesEnabled && sourceMode === "finance_confirmed_staging"
      ? "finance_confirmed_staging"
      : "mock";
  const inputLines = useMemo(() => parseQuoteDraftInput(submittedInput), [submittedInput]);
  const summary = useMemo(() => summarizeExportQuoteDraftPreviewLines(previewLines), [previewLines]);

  function buildMockPreview(nextInput: string, nextTradeMode = tradeMode) {
    return buildExportQuoteDraftPreviewLines({
      inputText: nextInput,
      tradeMode: nextTradeMode,
      sourceMode: "mock"
    });
  }

  async function buildStagingPreview(nextInput: string) {
    const lines = parseQuoteDraftInput(nextInput);
    const stagingCandidatesByLine: Record<number, ExportQuoteDraftSourceCandidate[]> = {};

    if (!stagingCandidatesEnabled || !findStagingCandidatesAction) {
      return buildExportQuoteDraftPreviewLines({
        inputText: nextInput,
        tradeMode,
        sourceMode: "finance_confirmed_staging",
        stagingEnabled: false
      });
    }

    for (const [index, line] of lines.entries()) {
      if (line.requestedCodeType !== "kj" || !line.requestedCode) {
        continue;
      }

      stagingCandidatesByLine[index + 1] = await findStagingCandidatesAction({
        kjCode: line.requestedCode,
        normalizedKjCode: line.requestedCode,
        tradeMode,
        limit: 20
      });
    }

    return buildExportQuoteDraftPreviewLines({
      inputText: nextInput,
      tradeMode,
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: true,
      stagingCandidatesByLine
    });
  }

  function fillSampleInput() {
    setInput(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
    setSubmittedInput(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
    setTradeMode(INITIAL_TRADE_MODE);
    setSourceMode("mock");
    setPreviewLines(buildInitialPreviewLines());
    setPreviewMessage("");
    setCopyMessage("");
    setExportMessage("");
  }

  async function runPreview() {
    setSubmittedInput(input);
    setCopyMessage("");
    setExportMessage("");

    if (isStagingSource(effectiveSourceMode)) {
      setIsStagingLookupPending(true);
      try {
        const nextPreviewLines = await buildStagingPreview(input);
        setPreviewLines(nextPreviewLines);
        setPreviewMessage("已生成 finance_confirmed staging 草稿候选预览。");
      } catch (error) {
        setPreviewLines(
          buildExportQuoteDraftPreviewLines({
            inputText: input,
            tradeMode,
            sourceMode: "finance_confirmed_staging",
            stagingCandidatesByLine: {}
          })
        );
        setPreviewMessage(error instanceof Error ? error.message : "staging 候选查询失败。");
      } finally {
        setIsStagingLookupPending(false);
      }
      return;
    }

    setPreviewLines(buildMockPreview(input));
    setPreviewMessage("已生成 Mock 草稿候选预览。");
  }

  async function copyResultJson() {
    const payload = {
      notice: "报价草稿预览仅用于内部 Workbench；不是正式报价，价格候选不是财务批准价格。",
      inputLines,
      previewLines
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopyMessage("已复制草稿预览 JSON。");
  }

  async function exportDraftExcel() {
    setExportMessage("");

    if (!excelExportEnabled) {
      setExportMessage("Excel 导出暂未开放。");
      return;
    }

    if (previewLines.length === 0) {
      setExportMessage("暂无可导出内容。请先生成草稿预览。");
      return;
    }

    setIsExcelExportPending(true);
    try {
      const XLSX = await import("xlsx");
      const workbookRows = buildExportQuoteDraftWorkbookRows(previewLines, summary);
      const worksheet = XLSX.utils.aoa_to_sheet(workbookRows);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "报价草稿预览");
      XLSX.writeFile(workbook, buildExportQuoteDraftExcelFileName());
      setExportMessage("已在本地生成询价 / 报价草稿 Excel。");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "草稿 Excel 导出失败。");
    } finally {
      setIsExcelExportPending(false);
    }
  }

  return (
    <div className="stack" data-testid="quote-draft-workbench">
      <section className="notice warn-notice">
        <h2>报价草稿解析器 Workbench</h2>
        <p>仅用于内部测试。当前使用 mock 数据，不读取真实报价表。</p>
        <p>feature flag 开启后可只读查询 finance_confirmed staging 候选；默认生产关闭。</p>
        <p>未来真实报价表 / 成本表 / 价格候选数据由财务提交和维护。</p>
        <p>出口部只能基于财务数据生成报价草稿，不能上传或维护价格表。</p>
        <p>本页面不会生成正式报价，价格候选不是财务批准价格，不能发客户。</p>
        {isExportManagerTrial ? (
          <p>当前为出口部经理内部试用，仅开放 Mock 数据和草稿 Excel 导出。</p>
        ) : null}
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <h2>KJ / 数量 / 备注</h2>
            <p className="muted">
              每行一条，支持空格、逗号、星号或 x 连接数量。OEM / OE 输入会被标记为暂不支持自动匹配。
            </p>
          </div>
          <span className="tag warn">
            {isStagingSource(effectiveSourceMode) ? "finance_confirmed staging" : "mock catalog only"}
          </span>
        </div>

        <div className="form-grid">
          <label>
            销售模式
            <select
              data-testid="quote-draft-trade-mode"
              value={tradeMode}
              onChange={(event) => setTradeMode(event.target.value as ExportQuoteDraftPreviewTradeMode)}
            >
              <option value="export_usd">外销 USD / export_usd</option>
              <option value="domestic_cny">内销 CNY / domestic_cny</option>
              <option value="unknown">未指定 / unknown</option>
            </select>
          </label>
          <fieldset className="stack">
            <legend>数据源</legend>
            <label className="inline-stack">
              <input
                type="radio"
                name="quote-draft-data-source"
                value="mock"
                checked={!isStagingSource(effectiveSourceMode)}
                onChange={() => setSourceMode("mock")}
              />
              Mock 数据
            </label>
            <label className="inline-stack">
              <input
                data-testid="quote-draft-staging-source-option"
                type="radio"
                name="quote-draft-data-source"
                value="finance_confirmed_staging"
                checked={isStagingSource(effectiveSourceMode)}
                disabled={!stagingCandidatesEnabled}
                onChange={() => setSourceMode("finance_confirmed_staging")}
              />
              财务确认 staging 候选
            </label>
            {!stagingCandidatesEnabled ? (
              <p className="muted tiny">
                {isExportManagerTrial
                  ? "出口部经理试用仅使用 Mock 数据；财务确认 staging 候选暂未开放。"
                  : "财务确认 staging 候选暂未开放。默认只使用 Mock 数据。"}
              </p>
            ) : (
              <p className="muted tiny">仅 super_admin 可只读查询 finance_confirmed staging 候选。</p>
            )}
          </fieldset>
        </div>

        <label>
          输入内容
          <textarea
            data-testid="quote-draft-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={8}
          />
        </label>
        <p className="muted tiny">
          示例：KJ12345 100pcs、KJ12345*100、KJ12345 x 100、KJ12345,100、KJ-ABC-001, 50, 客户要中性包装。
        </p>
        <div className="actions">
          <button className="ghost" type="button" onClick={fillSampleInput}>
            填入示例
          </button>
          <button type="button" onClick={runPreview} disabled={isStagingLookupPending}>
            生成草稿预览
          </button>
          <button className="secondary" type="button" onClick={copyResultJson} disabled={previewLines.length === 0}>
            复制预览 JSON
          </button>
          <button
            className="secondary"
            type="button"
            onClick={exportDraftExcel}
            disabled={!excelExportEnabled || previewLines.length === 0 || isExcelExportPending}
          >
            导出草稿 Excel
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setInput("");
              setSubmittedInput("");
              setPreviewLines([]);
              setPreviewMessage("");
              setCopyMessage("");
              setExportMessage("");
            }}
          >
            清空
          </button>
        </div>
        {!excelExportEnabled ? <p className="muted tiny">Excel 导出暂未开放。</p> : null}
        {excelExportEnabled && previewLines.length === 0 ? <p className="muted tiny">暂无可导出内容。</p> : null}
        {previewMessage ? <p className="muted tiny">{previewMessage}</p> : null}
        {copyMessage ? <p className="ok-text tiny">{copyMessage}</p> : null}
        {exportMessage ? <p className="ok-text tiny">{exportMessage}</p> : null}
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <h2>草稿候选预览</h2>
            <p className="muted">输出仅用于内部预览，不保存、不上传、不写数据库、不生成正式报价。</p>
            <p className="muted tiny">Excel 导出只导出当前页面预览结果，文件会标注询价 / 报价草稿、非正式报价。</p>
            {isStagingSource(effectiveSourceMode) ? (
              <p className="muted tiny">
                来源：finance_confirmed staging；finance_confirmed 不等于 FinanceApprovedPrice。
              </p>
            ) : null}
          </div>
          <div className="inline-stack">
            <span className="tag">输入 {inputLines.length} 行</span>
            <span className="tag">预览 {previewLines.length} 行</span>
          </div>
        </div>

        <div className="quote-draft-summary-grid" data-testid="quote-draft-summary">
          <div className="quote-draft-summary-card"><span>总行数</span><strong>{summary.total}</strong></div>
          <div className="quote-draft-summary-card"><span>可生成草稿预览</span><strong>{summary.ready}</strong></div>
          <div className="quote-draft-summary-card"><span>未找到候选</span><strong>{summary.notFound}</strong></div>
          <div className="quote-draft-summary-card"><span>多候选，需选择</span><strong>{summary.multipleCandidates}</strong></div>
          <div className="quote-draft-summary-card"><span>需人工确认</span><strong>{summary.manualReview}</strong></div>
          <div className="quote-draft-summary-card"><span>OEM 暂未开放</span><strong>{summary.unsupportedOem}</strong></div>
          <div className="quote-draft-summary-card"><span>缺少数量</span><strong>{summary.missingQuantity}</strong></div>
          <div className="quote-draft-summary-card"><span>非财务批准价格</span><strong>{summary.notFinanceApproved}</strong></div>
        </div>

        <div className="notice stack" data-testid="quote-draft-action-items">
          <div className="split">
            <div>
              <h3>待处理事项</h3>
              <p className="muted">这些事项只用于整理草稿预览，不会保存、不上传，也不会生成正式报价。</p>
            </div>
            <span className={summary.actionItems.length > 0 ? "tag warn" : "tag ok"}>
              {summary.actionItems.length > 0 ? `${summary.actionItems.length} 类待处理` : "暂无待处理异常"}
            </span>
          </div>
          {summary.actionItems.length > 0 ? (
            <div className="inline-stack">
              {summary.actionItems.map((item) => (
                <span className={actionItemClass(item)} key={item.type} title={item.message}>
                  {item.message}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">当前预览没有缺数量、未找到、多候选、OEM 暂未开放或非财务批准价格提醒。</p>
          )}
        </div>

        <div className="table-wrap">
          <table className="quote-draft-table" data-testid="quote-draft-preview-table">
            <thead>
              <tr>
                <th>行号</th>
                <th>原始输入</th>
                <th>识别编码</th>
                <th>数量</th>
                <th>备注</th>
                <th>销售模式</th>
                <th>数据源</th>
                <th>预览状态</th>
                <th>KJ</th>
                <th>产品名称</th>
                <th>品类</th>
                <th>价格候选状态</th>
                <th>风险提示</th>
              </tr>
            </thead>
            <tbody>
              {previewLines.length > 0 ? (
                previewLines.map((line) => (
                  <tr key={`${line.lineNo}-${line.rawInput}-${line.previewStatus}`}>
                    <td>{line.lineNo}</td>
                    <td className="quote-draft-raw-cell">{line.rawInput}</td>
                    <td>{line.requestedCode || "-"}</td>
                    <td>{line.quantity ?? "-"}</td>
                    <td title={line.customerNote}>{shortText(line.customerNote)}</td>
                    <td>{TRADE_MODE_LABELS[line.tradeMode]}</td>
                    <td>{SOURCE_MODE_LABELS[line.sourceMode]}</td>
                    <td><span className={previewStatusClass(line.previewStatus)}>{PREVIEW_STATUS_LABELS[line.previewStatus]}</span></td>
                    <td>{line.kjCode || "-"}</td>
                    <td>{line.productNameCandidate || "-"}</td>
                    <td>{line.category || "-"}</td>
                    <td>{priceCandidateStatusLabel(line.priceCandidateStatus)}</td>
                    <td className="quote-draft-warning-cell">
                      {line.warnings.length > 0 ? (
                        <div className="inline-stack">
                          {line.warnings.slice(0, 5).map((warning) => (
                            <span className={warningTagClass(warning)} key={warning} title={warning}>
                              {shortText(warning, 34)}
                            </span>
                          ))}
                          {line.warnings.length > 5 ? (
                            <span className="tag" title={line.warnings.slice(5).join("\n")}>
                              +{line.warnings.length - 5}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} className="muted">暂无草稿预览。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
