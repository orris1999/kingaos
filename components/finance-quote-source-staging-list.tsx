import Link from "next/link";

export type QuoteSourceStagingListItem = {
  id: string;
  sourceFileName: string;
  adapterId: string;
  category: string;
  dryRunDecisionStatus: string;
  status: string;
  submittedByRole: string;
  consumerDepartment: string;
  createdAt: string;
};

const BATCH_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  dry_run_passed: "dry-run 已通过",
  finance_confirmed: "财务已确认",
  adapter_fix_required: "需修正 adapter",
  finance_table_fix_required: "需财务修表",
  cancelled: "已取消"
};

const DRY_RUN_DECISION_LABELS: Record<string, string> = {
  ready_for_staging_design: "可进入 staging 设计",
  needs_finance_table_fix: "需财务修表",
  needs_adapter_fix: "需 adapter 修正",
  addon_only: "仅附加项候选",
  blocked: "阻断",
  manual_review_required: "需人工确认"
};

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

export function FinanceQuoteSourceStagingList({
  batches
}: {
  batches: QuoteSourceStagingListItem[];
}) {
  return (
    <section className="stack" data-testid="finance-quote-source-staging-list">
      <div className="notice warn-notice stack">
        <h2>报价表 staging</h2>
        <p>当前页面只读，不执行确认，不生成正式报价。</p>
        <p>QuoteSourceStagingBatch 只是 staging metadata，不等于 staging rows，也不等于导入价格。</p>
        <p>staging 不是正式价格表，finance_confirmed 不等于 FinanceApprovedPrice。</p>
        <p>export_draft_candidate 仍然不是正式报价，不能直接发客户。</p>
        <p>manual_review_required 不代表失败，只表示进入行级导入设计前需要人工确认。</p>
      </div>

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>批次 ID</th>
              <th>文件名</th>
              <th>adapterId</th>
              <th>品类</th>
              <th>dry-run decision</th>
              <th>当前 status</th>
              <th>submittedByRole</th>
              <th>consumerDepartment</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="stack">
                    <strong>暂无 staging 批次。</strong>
                    <span className="muted">
                      请先在 Finance 报价表 dry-run 页面完成结构识别和后续确认流程设计。
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.id}</td>
                  <td>{batch.sourceFileName}</td>
                  <td>{batch.adapterId}</td>
                  <td>{batch.category || "-"}</td>
                  <td>{DRY_RUN_DECISION_LABELS[batch.dryRunDecisionStatus] ?? batch.dryRunDecisionStatus}</td>
                  <td>
                    <span className={batch.status === "finance_confirmed" ? "tag ok" : "tag warn"}>
                      {BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                    </span>
                  </td>
                  <td>{batch.submittedByRole}</td>
                  <td>{batch.consumerDepartment}</td>
                  <td>{formatDate(batch.createdAt)}</td>
                  <td>
                    <Link href={`/finance/quote-source-staging/${batch.id}`}>查看详情</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}
