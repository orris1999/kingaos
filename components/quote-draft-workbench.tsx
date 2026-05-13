"use client";

import { useMemo, useState } from "react";
import {
  generateV1QuoteDraftCandidates,
  parseQuoteDraftInput,
  QUOTE_DRAFT_MOCK_CATALOG,
  QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT
} from "@/lib/honoa/quote-draft";
import type {
  ExportQuoteDraftSourceCandidate,
  FindExportQuoteDraftSourceCandidatesInput,
  QuoteDraftImageStatus,
  QuoteDraftLineCandidate,
  QuoteDraftMatchStatus,
  QuoteDraftPriceStatus,
  QuoteDraftRequestedCodeType,
  QuoteV1SourceReadiness
} from "@/lib/honoa/quote-draft";

const CODE_TYPE_LABELS: Record<QuoteDraftRequestedCodeType, string> = {
  kj: "KJ",
  oem: "OEM",
  oe: "OE",
  customer_part_no: "客户料号",
  unknown: "未知"
};

const MATCH_STATUS_LABELS: Record<QuoteDraftMatchStatus, string> = {
  matched_by_kj: "KJ 已匹配",
  kj_not_found: "KJ 未找到",
  ambiguous_kj: "KJ 多候选",
  matched_by_oem_candidate: "OEM 候选命中",
  oem_not_supported_yet: "OEM 暂未开放",
  requires_technical_review: "需技术确认"
};

const IMAGE_STATUS_LABELS: Record<QuoteDraftImageStatus, string> = {
  available: "有图片",
  missing: "缺图片",
  embedded_only: "仅 Excel 嵌入图",
  not_supported_yet: "暂不支持"
};

const PRICE_STATUS_LABELS: Record<QuoteDraftPriceStatus, string> = {
  candidate_cost_available: "成本候选",
  candidate_quote_available: "报价候选",
  missing: "无价格",
  expired: "已过期",
  requires_finance_review: "需财务核价",
  not_finance_approved: "非财务批准价格"
};

const V1_READINESS_LABELS: Record<QuoteV1SourceReadiness, string> = {
  v1_auto_eligible: "可进入 V1 草稿",
  v1_eligible_with_conditions: "可进入 V1，复杂规则",
  v1_manual_confirmation_required: "需人工确认",
  addon_only: "仅附加项候选",
  deferred: "暂缓"
};

const STAGING_PRICE_STATUS_LABELS: Record<ExportQuoteDraftSourceCandidate["priceCandidateStatus"], string> = {
  cost_candidate_available: "成本候选",
  quote_candidate_available: "报价候选",
  not_finance_approved: "非财务批准价格，仅草稿候选"
};

type QuoteDraftWorkbenchSource = "mock" | "finance_confirmed_staging";

type FindStagingCandidatesAction = (
  input: FindExportQuoteDraftSourceCandidatesInput
) => Promise<ExportQuoteDraftSourceCandidate[]>;

type QuoteDraftWorkbenchProps = {
  stagingCandidatesEnabled?: boolean;
  findStagingCandidatesAction?: FindStagingCandidatesAction;
};

type StagingWorkbenchStatus =
  | "matched"
  | "not_found"
  | "oem_not_supported_yet"
  | "requires_technical_review";

type StagingWorkbenchRow = {
  lineNo: number;
  rawInput: string;
  requestedCode: string;
  requestedCodeType: QuoteDraftRequestedCodeType;
  quantity?: number;
  status: StagingWorkbenchStatus;
  candidate?: ExportQuoteDraftSourceCandidate;
  warnings: string[];
};

function statusClass(candidate: QuoteDraftLineCandidate) {
  if (candidate.matchStatus === "matched_by_kj" && candidate.priceStatus !== "not_finance_approved") return "tag ok";
  if (candidate.matchStatus === "matched_by_kj") return "tag warn";
  if (candidate.matchStatus === "kj_not_found" || candidate.matchStatus === "ambiguous_kj") return "tag danger";
  return "tag warn";
}

function v1StatusClass(candidate: QuoteDraftLineCandidate) {
  if (candidate.isAddonOnly) return "tag warn";
  if (candidate.v1Readiness === "deferred") return "tag danger";
  if (candidate.requiresManualConfirmation) return "tag warn";
  return "tag ok";
}

function hasForbiddenQuoteFields(candidate: QuoteDraftLineCandidate) {
  const serialized = JSON.stringify(candidate);
  return (
    serialized.includes(["sent", "to", "customer"].join("_")) ||
    serialized.includes("official" + "Quote") ||
    serialized.includes("finance" + "Approved" + "Price")
  );
}

function stagingStatusLabel(status: StagingWorkbenchStatus) {
  if (status === "matched") return "已找到 staging 候选";
  if (status === "not_found") return "未找到财务确认的 staging 候选";
  if (status === "oem_not_supported_yet") return "OEM 暂未开放";
  return "需技术确认";
}

function stagingStatusClass(status: StagingWorkbenchStatus) {
  if (status === "matched") return "tag ok";
  if (status === "not_found") return "tag warn";
  return "tag danger";
}

function isStagingSource(source: QuoteDraftWorkbenchSource) {
  return source === "finance_confirmed_staging";
}

export function QuoteDraftWorkbench({
  stagingCandidatesEnabled = false,
  findStagingCandidatesAction
}: QuoteDraftWorkbenchProps) {
  const [input, setInput] = useState(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
  const [submittedInput, setSubmittedInput] = useState(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
  const [dataSource, setDataSource] = useState<QuoteDraftWorkbenchSource>("mock");
  const [stagingRows, setStagingRows] = useState<StagingWorkbenchRow[]>([]);
  const [isStagingLookupPending, setIsStagingLookupPending] = useState(false);
  const [stagingLookupMessage, setStagingLookupMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const effectiveDataSource: QuoteDraftWorkbenchSource =
    stagingCandidatesEnabled && dataSource === "finance_confirmed_staging"
      ? "finance_confirmed_staging"
      : "mock";
  const inputLines = useMemo(() => parseQuoteDraftInput(submittedInput), [submittedInput]);
  const candidates = useMemo(
    () => generateV1QuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG),
    [inputLines]
  );
  const summary = useMemo(() => ({
    total: candidates.length,
    matchedByKj: candidates.filter((candidate) => candidate.matchStatus === "matched_by_kj").length,
    kjNotFound: candidates.filter((candidate) => candidate.matchStatus === "kj_not_found").length,
    oemNotSupported: candidates.filter((candidate) => candidate.matchStatus === "oem_not_supported_yet").length,
    missingImage: candidates.filter((candidate) => candidate.imageStatus === "missing").length,
    missingPrice: candidates.filter((candidate) => candidate.priceStatus === "missing").length,
    notFinanceApproved: candidates.filter((candidate) => candidate.priceStatus === "not_finance_approved").length,
    technicalReview: candidates.filter((candidate) => candidate.matchStatus === "requires_technical_review").length,
    v1DraftEligible: candidates.filter((candidate) =>
      candidate.v1Readiness !== "deferred" && !candidate.requiresManualConfirmation && !candidate.isAddonOnly
    ).length,
    v1EligibleWithConditions: candidates.filter((candidate) => candidate.v1Readiness === "v1_eligible_with_conditions").length,
    manualConfirmation: candidates.filter((candidate) => candidate.requiresManualConfirmation).length,
    addonOnly: candidates.filter((candidate) => candidate.isAddonOnly).length,
    deferred: candidates.filter((candidate) => candidate.v1Readiness === "deferred").length
  }), [candidates]);
  const forbiddenOutputDetected = candidates.some(hasForbiddenQuoteFields);
  const stagingSummary = useMemo(() => ({
    total: stagingRows.length,
    matched: stagingRows.filter((row) => row.status === "matched").length,
    notFound: stagingRows.filter((row) => row.status === "not_found").length,
    oemNotSupported: stagingRows.filter((row) => row.status === "oem_not_supported_yet").length,
    notFinanceApproved: stagingRows.filter(
      (row) => row.candidate?.priceCandidateStatus === "not_finance_approved"
    ).length
  }), [stagingRows]);

  function fillSampleInput() {
    setInput(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
    setSubmittedInput(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
    setStagingRows([]);
    setStagingLookupMessage("");
    setCopyMessage("");
  }

  async function runStagingLookup() {
    const lines = parseQuoteDraftInput(input);
    setSubmittedInput(input);
    setStagingRows([]);
    setCopyMessage("");

    if (!stagingCandidatesEnabled || !findStagingCandidatesAction) {
      setStagingLookupMessage("该模式暂未开放。");
      return;
    }

    setIsStagingLookupPending(true);
    try {
      const nextRows: StagingWorkbenchRow[] = [];
      for (const [index, line] of lines.entries()) {
        const lineNo = index + 1;
        if (line.requestedCodeType === "oem" || line.requestedCodeType === "oe") {
          nextRows.push({
            lineNo,
            rawInput: line.rawInput,
            requestedCode: line.requestedCode,
            requestedCodeType: line.requestedCodeType,
            quantity: line.quantity,
            status: "oem_not_supported_yet",
            warnings: [...line.warnings, "OEM 自动匹配暂未开放。请使用 KJ 查询，或提交技术人工确认。"]
          });
          continue;
        }

        if (line.requestedCodeType !== "kj") {
          nextRows.push({
            lineNo,
            rawInput: line.rawInput,
            requestedCode: line.requestedCode,
            requestedCodeType: line.requestedCodeType,
            quantity: line.quantity,
            status: "requires_technical_review",
            warnings: [...line.warnings, "当前 staging 候选查询仅支持 KJ，不支持自动匹配其他编码。"]
          });
          continue;
        }

        const matches = await findStagingCandidatesAction({
          kjCode: line.requestedCode,
          normalizedKjCode: line.requestedCode,
          limit: 20
        });

        if (matches.length === 0) {
          nextRows.push({
            lineNo,
            rawInput: line.rawInput,
            requestedCode: line.requestedCode,
            requestedCodeType: line.requestedCodeType,
            quantity: line.quantity,
            status: "not_found",
            warnings: [...line.warnings, "未找到财务确认的 staging 候选。"]
          });
          continue;
        }

        for (const candidate of matches) {
          nextRows.push({
            lineNo,
            rawInput: line.rawInput,
            requestedCode: line.requestedCode,
            requestedCodeType: line.requestedCodeType,
            quantity: line.quantity,
            status: "matched",
            candidate,
            warnings: [...line.warnings, ...candidate.warnings]
          });
        }
      }

      setStagingRows(nextRows);
      setStagingLookupMessage(
        nextRows.length > 0
          ? "已完成 finance_confirmed staging 候选只读查询。"
          : "没有可查询的输入行。"
      );
    } catch (error) {
      setStagingRows([]);
      setStagingLookupMessage(error instanceof Error ? error.message : "staging 候选查询失败。");
    } finally {
      setIsStagingLookupPending(false);
    }
  }

  async function runWorkbench() {
    if (isStagingSource(effectiveDataSource)) {
      await runStagingLookup();
      return;
    }
    setSubmittedInput(input);
    setStagingRows([]);
    setStagingLookupMessage("");
    setCopyMessage("");
  }

  async function copyResultJson() {
    const payload = isStagingSource(effectiveDataSource)
      ? {
          notice:
            "finance_confirmed staging 候选仅用于内部报价草稿 Workbench；不是正式报价，价格候选不是财务批准价格。",
          inputLines,
          candidates: stagingRows
        }
      : {
          notice: "mock 数据，仅用于内部报价草稿解析器 workbench；不是正式报价，价格候选不是财务批准价格。",
          inputLines,
          candidates
        };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopyMessage(isStagingSource(effectiveDataSource) ? "已复制 staging 候选 JSON。" : "已复制 mock 结果 JSON。");
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
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <h2>粘贴 KJ / 数量 / 备注</h2>
            <p className="muted">每行一条。OEM / OE 输入会被标记为暂不支持自动匹配。</p>
          </div>
          <span className="tag warn">
            {isStagingSource(effectiveDataSource) ? "finance_confirmed staging" : "mock catalog only"}
          </span>
        </div>
        <fieldset className="stack">
          <legend>数据源</legend>
          <label className="inline-stack">
            <input
              type="radio"
              name="quote-draft-data-source"
              value="mock"
              checked={!isStagingSource(effectiveDataSource)}
              onChange={() => {
                setDataSource("mock");
                setStagingRows([]);
                setStagingLookupMessage("");
              }}
            />
            Mock 数据
          </label>
          <label className="inline-stack">
            <input
              data-testid="quote-draft-staging-source-option"
              type="radio"
              name="quote-draft-data-source"
              value="finance_confirmed_staging"
              checked={isStagingSource(effectiveDataSource)}
              disabled={!stagingCandidatesEnabled}
              onChange={() => setDataSource("finance_confirmed_staging")}
            />
            财务确认 staging 候选
          </label>
          {!stagingCandidatesEnabled ? (
            <p className="muted tiny">该模式暂未开放。默认只使用 Mock 数据。</p>
          ) : (
            <p className="muted tiny">仅 super_admin 可只读查询 finance_confirmed staging 候选。</p>
          )}
        </fieldset>
        <label>
          输入内容
          <textarea
            data-testid="quote-draft-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={7}
          />
        </label>
        <div className="actions">
          <button className="ghost" type="button" onClick={fillSampleInput}>
            填入示例
          </button>
          <button type="button" onClick={runWorkbench} disabled={isStagingLookupPending}>
            {isStagingSource(effectiveDataSource) ? "查询 staging 候选" : "生成草稿候选"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={copyResultJson}
            disabled={isStagingSource(effectiveDataSource) ? stagingRows.length === 0 : candidates.length === 0}
          >
            复制结果 JSON
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setInput("");
              setSubmittedInput("");
              setStagingRows([]);
              setStagingLookupMessage("");
              setCopyMessage("");
            }}
          >
            清空
          </button>
        </div>
        {stagingLookupMessage ? <p className="muted tiny">{stagingLookupMessage}</p> : null}
        {copyMessage ? <p className="ok-text tiny">{copyMessage}</p> : null}
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <h2>草稿候选结果</h2>
            <p className="muted">输出仅用于解析器演示，不保存、不导出、不生成正式报价。</p>
            {isStagingSource(effectiveDataSource) ? (
              <p className="muted tiny">
                来源：finance_confirmed staging；finance_confirmed 不等于 FinanceApprovedPrice。
              </p>
            ) : null}
          </div>
          <div className="inline-stack">
            <span className="tag">输入 {inputLines.length} 行</span>
            <span className="tag">
              候选 {isStagingSource(effectiveDataSource) ? stagingRows.length : candidates.length} 行
            </span>
          </div>
        </div>

        {isStagingSource(effectiveDataSource) ? (
          <div className="quote-draft-summary-grid" data-testid="quote-draft-staging-summary">
            <div className="quote-draft-summary-card"><span>总行数</span><strong>{stagingSummary.total}</strong></div>
            <div className="quote-draft-summary-card"><span>已找到 staging 候选</span><strong>{stagingSummary.matched}</strong></div>
            <div className="quote-draft-summary-card"><span>未找到财务确认的 staging 候选</span><strong>{stagingSummary.notFound}</strong></div>
            <div className="quote-draft-summary-card"><span>OEM 暂未开放</span><strong>{stagingSummary.oemNotSupported}</strong></div>
            <div className="quote-draft-summary-card"><span>非财务批准价格</span><strong>{stagingSummary.notFinanceApproved}</strong></div>
          </div>
        ) : (
          <div className="quote-draft-summary-grid" data-testid="quote-draft-summary">
          <div className="quote-draft-summary-card"><span>总行数</span><strong>{summary.total}</strong></div>
          <div className="quote-draft-summary-card"><span>KJ 已匹配</span><strong>{summary.matchedByKj}</strong></div>
          <div className="quote-draft-summary-card"><span>KJ 未找到</span><strong>{summary.kjNotFound}</strong></div>
          <div className="quote-draft-summary-card"><span>OEM 暂未开放</span><strong>{summary.oemNotSupported}</strong></div>
          <div className="quote-draft-summary-card"><span>缺图片</span><strong>{summary.missingImage}</strong></div>
          <div className="quote-draft-summary-card"><span>无价格</span><strong>{summary.missingPrice}</strong></div>
          <div className="quote-draft-summary-card"><span>非财务批准价格</span><strong>{summary.notFinanceApproved}</strong></div>
          <div className="quote-draft-summary-card"><span>需技术确认</span><strong>{summary.technicalReview}</strong></div>
          <div className="quote-draft-summary-card"><span>可进入 V1 草稿</span><strong>{summary.v1DraftEligible}</strong></div>
          <div className="quote-draft-summary-card"><span>可进入 V1，复杂规则</span><strong>{summary.v1EligibleWithConditions}</strong></div>
          <div className="quote-draft-summary-card"><span>需人工确认</span><strong>{summary.manualConfirmation}</strong></div>
          <div className="quote-draft-summary-card"><span>仅附加项候选</span><strong>{summary.addonOnly}</strong></div>
          <div className="quote-draft-summary-card"><span>暂缓</span><strong>{summary.deferred}</strong></div>
          </div>
        )}

        {forbiddenOutputDetected ? (
          <p className="error">检测到不允许的正式报价字段，请停止使用本结果。</p>
        ) : null}

        {isStagingSource(effectiveDataSource) ? (
          <div className="table-wrap">
            <table className="quote-draft-table" data-testid="quote-draft-staging-result-table">
              <thead>
                <tr>
                  <th>行号</th>
                  <th>原始输入</th>
                  <th>KJ</th>
                  <th>产品名称候选</th>
                  <th>品类</th>
                  <th>tradeMode</th>
                  <th>数量</th>
                  <th>priceCandidateStatus</th>
                  <th>hasCostCandidate</th>
                  <th>hasQuoteCandidate</th>
                  <th>来源 / 状态</th>
                  <th>warnings</th>
                </tr>
              </thead>
              <tbody>
                {stagingRows.length > 0 ? (
                  stagingRows.map((row, index) => (
                    <tr key={`${row.lineNo}-${row.rawInput}-${row.candidate?.stagingRowId ?? row.status}-${index}`}>
                      <td>{row.lineNo}</td>
                      <td className="quote-draft-raw-cell">{row.rawInput}</td>
                      <td>{row.candidate?.standardKjCode || row.candidate?.baseKjCode || row.requestedCode || "-"}</td>
                      <td>{row.candidate?.productNameCandidate || "-"}</td>
                      <td>{row.candidate?.category || "-"}</td>
                      <td>{row.candidate?.tradeMode || "-"}</td>
                      <td>{row.quantity ?? "-"}</td>
                      <td>
                        {row.candidate
                          ? STAGING_PRICE_STATUS_LABELS[row.candidate.priceCandidateStatus]
                          : "-"}
                      </td>
                      <td>{row.candidate?.hasCostCandidate ? "是" : "否"}</td>
                      <td>{row.candidate?.hasQuoteCandidate ? "是" : "否"}</td>
                      <td>
                        <span className={stagingStatusClass(row.status)}>{stagingStatusLabel(row.status)}</span>
                        {row.candidate ? <span className="tag soft">finance_confirmed staging</span> : null}
                      </td>
                      <td className="quote-draft-warning-cell">
                        {row.warnings.length > 0 ? (
                          <ul>
                            {row.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                          </ul>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="muted">尚未查询 staging 候选。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
          <table className="quote-draft-table" data-testid="quote-draft-result-table">
            <thead>
              <tr>
                <th>行号</th>
                <th>原始输入</th>
                <th>识别编码</th>
                <th>输入类型</th>
                <th>匹配状态</th>
                <th>V1 状态</th>
                <th>KJ</th>
                <th>产品名称</th>
                <th>品类</th>
                <th>数量</th>
                <th>图片状态</th>
                <th>价格状态</th>
                <th>风险提示</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate, index) => {
                const inputLine = inputLines[index];
                return (
                  <tr key={`${candidate.lineNo}-${candidate.rawInput}`}>
                    <td>{candidate.lineNo}</td>
                    <td className="quote-draft-raw-cell">{candidate.rawInput}</td>
                    <td>{inputLine?.requestedCode || "-"}</td>
                    <td>{inputLine ? CODE_TYPE_LABELS[inputLine.requestedCodeType] : "-"}</td>
                    <td><span className={statusClass(candidate)}>{MATCH_STATUS_LABELS[candidate.matchStatus]}</span></td>
                    <td>
                      <span className={v1StatusClass(candidate)}>
                        {candidate.v1ReadinessLabel || (candidate.v1Readiness ? V1_READINESS_LABELS[candidate.v1Readiness] : "-")}
                      </span>
                      {candidate.v1Readiness === "v1_eligible_with_conditions" ? (
                        <span className="tag soft">可进入 V1，复杂规则</span>
                      ) : null}
                    </td>
                    <td>{candidate.kjCode || "-"}</td>
                    <td>{candidate.productName || "-"}</td>
                    <td>{candidate.category || "-"}</td>
                    <td>{candidate.quantity ?? "-"}</td>
                    <td>{IMAGE_STATUS_LABELS[candidate.imageStatus]}</td>
                    <td>{PRICE_STATUS_LABELS[candidate.priceStatus]}</td>
                    <td className="quote-draft-warning-cell">
                      {candidate.warnings.length > 0 ? (
                        <ul>
                          {candidate.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
