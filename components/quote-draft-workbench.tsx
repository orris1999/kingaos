"use client";

import { useMemo, useState } from "react";
import {
  generateQuoteDraftCandidates,
  parseQuoteDraftInput,
  QUOTE_DRAFT_MOCK_CATALOG,
  QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT
} from "@/lib/honoa/quote-draft";
import type {
  QuoteDraftImageStatus,
  QuoteDraftLineCandidate,
  QuoteDraftMatchStatus,
  QuoteDraftPriceStatus,
  QuoteDraftRequestedCodeType
} from "@/lib/honoa/quote-draft";

const CODE_TYPE_LABELS: Record<QuoteDraftRequestedCodeType, string> = {
  kj: "KJ",
  oem: "OEM",
  oe: "OE",
  customer_part_no: "客户料号",
  unknown: "未知"
};

const MATCH_STATUS_LABELS: Record<QuoteDraftMatchStatus, string> = {
  matched_by_kj: "KJ 命中",
  kj_not_found: "KJ 未找到",
  ambiguous_kj: "KJ 多候选",
  matched_by_oem_candidate: "OEM 候选命中",
  oem_not_supported_yet: "OEM 暂不支持",
  requires_technical_review: "需要技术确认"
};

const IMAGE_STATUS_LABELS: Record<QuoteDraftImageStatus, string> = {
  available: "有稳定图片",
  missing: "缺少图片",
  embedded_only: "仅 Excel 嵌入图",
  not_supported_yet: "暂不支持"
};

const PRICE_STATUS_LABELS: Record<QuoteDraftPriceStatus, string> = {
  candidate_cost_available: "成本候选",
  candidate_quote_available: "报价候选",
  missing: "缺少价格",
  expired: "已过期",
  requires_finance_review: "需财务确认",
  not_finance_approved: "非财务批准价"
};

function statusClass(candidate: QuoteDraftLineCandidate) {
  if (candidate.matchStatus === "matched_by_kj" && candidate.priceStatus !== "not_finance_approved") return "tag ok";
  if (candidate.matchStatus === "matched_by_kj") return "tag warn";
  if (candidate.matchStatus === "kj_not_found" || candidate.matchStatus === "ambiguous_kj") return "tag danger";
  return "tag warn";
}

function hasForbiddenQuoteFields(candidate: QuoteDraftLineCandidate) {
  const serialized = JSON.stringify(candidate);
  return (
    serialized.includes(["sent", "to", "customer"].join("_")) ||
    serialized.includes("official" + "Quote") ||
    serialized.includes("finance" + "Approved" + "Price")
  );
}

export function QuoteDraftWorkbench() {
  const [input, setInput] = useState(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);
  const [submittedInput, setSubmittedInput] = useState(QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT);

  const inputLines = useMemo(() => parseQuoteDraftInput(submittedInput), [submittedInput]);
  const candidates = useMemo(
    () => generateQuoteDraftCandidates(inputLines, QUOTE_DRAFT_MOCK_CATALOG),
    [inputLines]
  );
  const forbiddenOutputDetected = candidates.some(hasForbiddenQuoteFields);

  return (
    <div className="stack" data-testid="quote-draft-workbench">
      <section className="notice warn-notice">
        <h2>报价草稿解析器 Workbench</h2>
        <p>仅用于内部测试。当前使用 mock 数据，不读取真实报价表。</p>
        <p>本页面不会生成正式报价，价格候选不是财务批准价格，不能发客户。</p>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <h2>粘贴 KJ / 数量 / 备注</h2>
            <p className="muted">每行一条。OEM / OE 输入会被标记为暂不支持自动匹配。</p>
          </div>
          <span className="tag warn">mock catalog only</span>
        </div>
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
          <button type="button" onClick={() => setSubmittedInput(input)}>
            生成草稿候选
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setInput("");
              setSubmittedInput("");
            }}
          >
            清空
          </button>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <h2>草稿候选结果</h2>
            <p className="muted">输出仅用于解析器演示，不保存、不导出、不生成正式报价。</p>
          </div>
          <div className="inline-stack">
            <span className="tag">输入 {inputLines.length} 行</span>
            <span className="tag">候选 {candidates.length} 行</span>
          </div>
        </div>

        {forbiddenOutputDetected ? (
          <p className="error">检测到不允许的正式报价字段，请停止使用本结果。</p>
        ) : null}

        <div className="table-wrap">
          <table className="quote-draft-table" data-testid="quote-draft-result-table">
            <thead>
              <tr>
                <th>行号</th>
                <th>原始输入</th>
                <th>识别编码</th>
                <th>输入类型</th>
                <th>匹配状态</th>
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
      </section>
    </div>
  );
}
