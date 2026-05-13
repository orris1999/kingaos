import Link from "next/link";

export type QuoteSourceStagingDetailRow = {
  id: string;
  sourceRowNumber?: number;
  standardKjCode?: string;
  rawKjCode?: string;
  productNameCandidate?: string;
  category?: string;
  priceCandidateStatus: string;
  visibility: string;
  rowStatus: string;
  warnings: string[];
};

export type QuoteSourceStagingDetailData = {
  id: string;
  sourceFileName: string;
  adapterId: string;
  category: string;
  dryRunDecisionStatus: string;
  status: string;
  submittedByRole: string;
  consumerDepartment: string;
  createdByUserId?: string;
  createdByName?: string;
  createdAt: string;
  confirmedByUserId?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  warnings: string[];
  notes?: string;
  rows: QuoteSourceStagingDetailRow[];
};

const ROW_STATUS_LABELS: Record<string, string> = {
  candidate: "候选行",
  needs_manual_review: "需人工确认",
  addon_only: "仅附加项",
  blocked: "阻断",
  ignored: "忽略"
};

const VISIBILITY_LABELS: Record<string, string> = {
  finance_only: "仅财务可见",
  export_draft_candidate: "出口草稿候选",
  internal_risk_only: "仅内部风险"
};

const PRICE_STATUS_LABELS: Record<string, string> = {
  cost_candidate_available: "成本候选可用",
  quote_candidate_available: "报价候选可用",
  missing: "无价格候选",
  not_finance_approved: "非财务批准价格",
  requires_finance_review: "需财务核价"
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

function countRows(rows: QuoteSourceStagingDetailRow[], key: "rowStatus" | "visibility", value: string) {
  return rows.filter((row) => row[key] === value).length;
}

function canBecomeExportDraftCandidate(row: QuoteSourceStagingDetailRow) {
  return (
    row.rowStatus === "candidate" &&
    row.visibility === "finance_only" &&
    ["cost_candidate_available", "quote_candidate_available", "not_finance_approved"].includes(
      row.priceCandidateStatus
    )
  );
}

export function FinanceQuoteSourceStagingDetail({
  batch
}: {
  batch: QuoteSourceStagingDetailData | null;
}) {
  if (!batch) {
    return (
      <section className="panel stack" data-testid="finance-quote-source-staging-detail-empty">
        <h2>未找到 staging 批次</h2>
        <p className="muted">当前批次不存在，或已不在可查看范围内。</p>
        <div className="actions">
          <Link className="button ghost" href="/finance/quote-source-staging">返回 staging 列表</Link>
        </div>
      </section>
    );
  }

  const totalRows = batch.rows.length;
  const candidateRows = countRows(batch.rows, "rowStatus", "candidate");
  const manualReviewRows = countRows(batch.rows, "rowStatus", "needs_manual_review");
  const addonOnlyRows = countRows(batch.rows, "rowStatus", "addon_only");
  const blockedRows = countRows(batch.rows, "rowStatus", "blocked");
  const ignoredRows = countRows(batch.rows, "rowStatus", "ignored");
  const exportDraftCandidatePreviewRows = batch.rows.filter(canBecomeExportDraftCandidate).length;
  const financeOnlyRows = countRows(batch.rows, "visibility", "finance_only");
  const internalRiskOnlyRows = countRows(batch.rows, "visibility", "internal_risk_only");

  return (
    <section className="stack" data-testid="finance-quote-source-staging-detail">
      <div className="notice warn-notice stack">
        <h2>只读确认预览</h2>
        <p>本轮只读，不执行任何确认动作。</p>
        <p>成本价不是财务批准价格。</p>
        <p>finance_confirmed 不等于 FinanceApprovedPrice。</p>
        <p>export_draft_candidate 不是正式报价。</p>
        <p>needs_manual_review 默认不会给出口部消费。</p>
        <p>addon_only / blocked / ignored 不会给出口部消费。</p>
      </div>

      <section className="panel stack">
        <div className="split">
          <div>
            <h2>Batch 基本信息</h2>
            <p className="muted">staging 只展示结构 metadata，不展示敏感价格字段。</p>
          </div>
          <Link className="button ghost" href="/finance/quote-source-staging">返回列表</Link>
        </div>
        <div className="detail-grid">
          <div className="kv"><b>文件名</b><span>{batch.sourceFileName}</span></div>
          <div className="kv"><b>adapterId</b><span>{batch.adapterId}</span></div>
          <div className="kv"><b>品类</b><span>{batch.category || "-"}</span></div>
          <div className="kv"><b>dry-run decision</b><span>{batch.dryRunDecisionStatus}</span></div>
          <div className="kv"><b>当前 status</b><span>{batch.status}</span></div>
          <div className="kv"><b>submittedByRole</b><span>{batch.submittedByRole}</span></div>
          <div className="kv"><b>consumerDepartment</b><span>{batch.consumerDepartment}</span></div>
          <div className="kv"><b>createdBy</b><span>{batch.createdByName || batch.createdByUserId || "-"}</span></div>
          <div className="kv"><b>createdAt</b><span>{formatDate(batch.createdAt)}</span></div>
          <div className="kv"><b>confirmedBy</b><span>{batch.confirmedByName || batch.confirmedByUserId || "-"}</span></div>
          <div className="kv"><b>confirmedAt</b><span>{formatDate(batch.confirmedAt)}</span></div>
          <div className="kv"><b>notes</b><span>{batch.notes || "-"}</span></div>
        </div>
      </section>

      <section className="panel stack">
        <h2>Row 统计</h2>
        <div className="quote-draft-summary-grid">
          <SummaryCard label="总行数" value={totalRows} />
          <SummaryCard label="candidate 行" value={candidateRows} />
          <SummaryCard label="needs_manual_review 行" value={manualReviewRows} />
          <SummaryCard label="addon_only 行" value={addonOnlyRows} />
          <SummaryCard label="blocked 行" value={blockedRows} />
          <SummaryCard label="ignored 行" value={ignoredRows} />
        </div>
      </section>

      <section className="panel stack">
        <h2>出口部可消费预览</h2>
        <p className="muted">以下只是 strict_candidate_only 策略下的只读预览，不会修改 row visibility。</p>
        <div className="quote-draft-summary-grid">
          <SummaryCard label="将会变成 export_draft_candidate" value={exportDraftCandidatePreviewRows} />
          <SummaryCard label="仍保持 finance_only" value={financeOnlyRows} />
          <SummaryCard label="internal_risk_only" value={internalRiskOnlyRows} />
        </div>
      </section>

      <section className="panel stack">
        <h2>财务确认区域</h2>
        <p className="muted">本轮只读，不执行任何确认动作。确认、退回和取消将在下一阶段开放。</p>
        <div className="actions">
          <button type="button" disabled>确认进入草稿候选（下一阶段开放）</button>
          <button type="button" disabled>退回修正（下一阶段开放）</button>
          <button type="button" disabled>取消批次（下一阶段开放）</button>
        </div>
      </section>

      <section className="panel stack">
        <h2>风险提示</h2>
        <ul>
          {[
            "成本价不是财务批准价格。",
            "finance_confirmed 不等于 FinanceApprovedPrice。",
            "export_draft_candidate 不是正式报价。",
            "needs_manual_review 默认不会给出口部消费。",
            "addon_only / blocked / ignored 不会给出口部消费。",
            ...batch.warnings
          ].map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2>Rows 只读摘要</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>源行号</th>
                <th>KJ 候选</th>
                <th>产品候选名</th>
                <th>品类</th>
                <th>rowStatus</th>
                <th>visibility</th>
                <th>priceCandidateStatus</th>
                <th>warnings</th>
              </tr>
            </thead>
            <tbody>
              {batch.rows.length === 0 ? (
                <tr><td colSpan={8}>暂无 staging row。</td></tr>
              ) : (
                batch.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sourceRowNumber ?? "-"}</td>
                    <td>{row.standardKjCode || row.rawKjCode || "-"}</td>
                    <td>{row.productNameCandidate || "-"}</td>
                    <td>{row.category || "-"}</td>
                    <td>{ROW_STATUS_LABELS[row.rowStatus] ?? row.rowStatus}</td>
                    <td>{VISIBILITY_LABELS[row.visibility] ?? row.visibility}</td>
                    <td>{PRICE_STATUS_LABELS[row.priceCandidateStatus] ?? row.priceCandidateStatus}</td>
                    <td>{row.warnings.length > 0 ? row.warnings.join("；") : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="quote-draft-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
