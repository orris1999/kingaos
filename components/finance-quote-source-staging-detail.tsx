import Link from "next/link";
import { precheckQuoteSourceStagingRowImport } from "@/lib/honoa/quote-draft/source-staging-row-import-precheck";
import { FinanceQuoteCandidateValueImportForm } from "./finance-quote-candidate-value-import-form";
import { FinanceQuoteSourceStagingConfirmForm } from "./finance-quote-source-staging-confirm-form";

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
  batch,
  confirmationEnabled = false,
  rowImportEnabled = false,
  candidateValueImportEnabled = false
}: {
  batch: QuoteSourceStagingDetailData | null;
  confirmationEnabled?: boolean;
  rowImportEnabled?: boolean;
  candidateValueImportEnabled?: boolean;
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
  const rowImportPrecheck = precheckQuoteSourceStagingRowImport({
    batchId: batch.id,
    adapterId: batch.adapterId,
    category: batch.category,
    status: batch.status,
    dryRunDecisionStatus: batch.dryRunDecisionStatus,
    rowCount: totalRows,
    uploadDryRunWarnings: batch.warnings
  });

  return (
    <section className="stack" data-testid="finance-quote-source-staging-detail">
      <div className="notice warn-notice stack">
        <h2>staging batch metadata 只读预览</h2>
        <p>本轮只读，不执行任何确认动作。</p>
        <p>当前只有 staging batch metadata，当前还没有 staging rows。</p>
        <p>当前还没有导入价格，当前还不能给出口部使用。</p>
        <p>当前不能生成报价草稿，当前不能生成正式报价。</p>
        <p>manual_review_required 不代表失败；它表示 dry-run 结构识别已完成，但进入行级导入前需要人工确认。</p>
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
        {totalRows === 0 ? (
          <p className="warn-text">尚未导入行级候选数据。请先完成行级导入前检查。</p>
        ) : null}
      </section>

      <section className="panel stack">
        <h2>行级导入前检查</h2>
        <p className="muted">
          该检查只回答是否可以进入行级导入设计；不会执行行级导入，不会创建 staging rows，不会保存价格。
        </p>
        <div className="detail-grid">
          <div className="kv"><b>precheck status</b><span>{rowImportPrecheck.status}</span></div>
          <div className="kv"><b>可进入行级导入设计</b><span>{rowImportPrecheck.canDesignRowImport ? "是" : "否"}</span></div>
          <div className="kv"><b>现在可导入 rows</b><span>否</span></div>
        </div>
        {batch.dryRunDecisionStatus === "manual_review_required" ? (
          <div className="notice stack">
            <strong>manual_review_required 需要人工确认，不是失败。</strong>
            <p>请确认当前 adapter 是否正确、category 是否正确、dry-run warnings 是否可接受。</p>
            <p>该批次可以进入行级导入前检查，但还不能直接导入 rows。</p>
          </div>
        ) : null}
        <div className="split">
          <div className="stack">
            <h3>原因</h3>
            <ul>
              {rowImportPrecheck.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="stack">
            <h3>下一步</h3>
            <ul>
              {rowImportPrecheck.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <h2>行级导入</h2>
        <p className="muted">
          本阶段受服务端 feature flag 控制，只用于 local / test DB 验证。production 默认关闭，不自动创建 rows。
        </p>
        <button className="button" type="button" disabled>
          {rowImportEnabled ? "行级导入仅限 local/test 验证" : "行级导入暂未开放"}
        </button>
        <p className="muted">
          第一版只支持 condenser-cost-2026 / 冷凝器；导入 rows 仍默认 finance_only，不会给出口部直接消费。
        </p>
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
        <p className="muted">
          确认功能受服务端 feature flag 控制。默认生产关闭，不启用时本页不执行写入。
        </p>
        <FinanceQuoteSourceStagingConfirmForm
          batchId={batch.id}
          batchStatus={batch.status}
          enabled={confirmationEnabled}
        />
      </section>

      <section className="panel stack">
        <h2>候选金额导入</h2>
        <p className="muted">
          该入口只用于已登录 super_admin 的 UAT；请求必须由当前页面发起，浏览器会携带 httpOnly session cookie。
        </p>
        <p className="muted">
          不从前端传 actorUserId；服务端只从 requireCurrentUser 识别操作者。
        </p>
        <FinanceQuoteCandidateValueImportForm
          batchId={batch.id}
          batchStatus={batch.status}
          enabled={candidateValueImportEnabled}
        />
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
                <tr><td colSpan={8}>尚未导入行级候选数据。请先完成行级导入前检查。</td></tr>
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
