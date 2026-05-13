import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { confirmQuoteSourceStagingBatchAction } from "@/lib/honoa/quote-draft/source-staging-actions";

const RISK_CONFIRMATION_TEXT =
  "我已确认以上风险，确认进入草稿候选";

async function confirmFinanceQuoteSourceStagingBatch(formData: FormData) {
  "use server";

  const batchId = String(formData.get("batchId") ?? "");
  const confirmationNote = String(formData.get("confirmationNote") ?? "").trim();
  const riskAcknowledged = formData.get("riskAcknowledged") === "on";

  if (!batchId) {
    throw new Error("batchId is required");
  }
  if (!riskAcknowledged) {
    throw new Error("请先确认 staging 风险提示。");
  }

  await confirmQuoteSourceStagingBatchAction({
    batchId,
    confirmationNote: confirmationNote || undefined,
    rowVisibilityPolicy: "strict_candidate_only"
  });

  revalidatePath("/finance/quote-source-staging");
  revalidatePath(`/finance/quote-source-staging/${batchId}`);
  redirect(`/finance/quote-source-staging/${batchId}`);
}

export function FinanceQuoteSourceStagingConfirmForm({
  batchId,
  enabled,
  batchStatus
}: {
  batchId: string;
  enabled: boolean;
  batchStatus: string;
}) {
  const canSubmit = enabled && batchStatus === "dry_run_passed";

  if (!enabled) {
    return (
      <div className="stack" data-testid="finance-staging-confirm-disabled">
        <p className="muted">当前确认功能未启用。本页仅展示 staging 批次，不执行写入。</p>
        <div className="actions">
          <button type="button" disabled>确认进入草稿候选（暂未开放）</button>
          <button type="button" disabled>退回修正（下一阶段开放）</button>
          <button type="button" disabled>取消批次（下一阶段开放）</button>
        </div>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="stack" data-testid="finance-staging-confirm-status-disabled">
        <p className="muted">当前 batch status 为 {batchStatus}，不能执行确认。</p>
        <div className="actions">
          <button type="button" disabled>确认进入草稿候选（当前状态不可确认）</button>
          <button type="button" disabled>退回修正（下一阶段开放）</button>
          <button type="button" disabled>取消批次（下一阶段开放）</button>
        </div>
      </div>
    );
  }

  return (
    <form className="stack" action={confirmFinanceQuoteSourceStagingBatch} data-testid="finance-staging-confirm-form">
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="rowVisibilityPolicy" value="strict_candidate_only" />
      <div className="notice warn-notice stack">
        <h3>确认前请再次核对</h3>
        <p>确认将该批报价表 staging 标记为“财务已确认可作为报价草稿候选数据源”？</p>
        <ol>
          <li>这不是正式报价。</li>
          <li>这不是财务批准价格。</li>
          <li>这不会生成可发客户的报价单。</li>
          <li>只有符合条件的 candidate 行会成为出口部报价草稿候选。</li>
          <li>needs_manual_review / addon_only / blocked / ignored 行不会自动给出口部使用。</li>
        </ol>
      </div>

      <label className="field">
        <span>确认说明（可选）</span>
        <textarea
          name="confirmationNote"
          rows={3}
          placeholder="例如：财务确认该 staging batch 可作为报价草稿候选数据源。"
        />
      </label>

      <label className="checkbox-row">
        <input type="checkbox" name="riskAcknowledged" required />
        <span>{RISK_CONFIRMATION_TEXT}</span>
      </label>

      <div className="actions">
        <button type="submit">{RISK_CONFIRMATION_TEXT}</button>
        <button type="button" disabled>退回修正（下一阶段开放）</button>
        <button type="button" disabled>取消批次（下一阶段开放）</button>
      </div>
    </form>
  );
}
