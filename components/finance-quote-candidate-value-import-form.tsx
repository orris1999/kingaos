"use client";

import { useMemo, useState, type FormEvent } from "react";

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ImportResult = {
  candidateAmountCount?: number;
  rowCount?: number;
  skippedCount?: number;
  currencies?: string[];
};

export function FinanceQuoteCandidateValueImportForm({
  batchId,
  batchStatus,
  enabled
}: {
  batchId: string;
  batchStatus: string;
  enabled: boolean;
}) {
  const [tradeModes, setTradeModes] = useState({
    export_usd: true,
    domestic_cny: true
  });
  const [state, setState] = useState<ImportState>({ status: "idle" });

  const selectedTradeModes = useMemo(
    () => Object.entries(tradeModes).filter(([, selected]) => selected).map(([tradeMode]) => tradeMode),
    [tradeModes]
  );
  const canSubmit = enabled && batchStatus === "finance_confirmed" && selectedTradeModes.length > 0 && state.status !== "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setState({ status: "loading" });
    const response = await fetch(`/api/finance/quote-source-staging/${batchId}/import-candidate-amounts`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tradeModes: selectedTradeModes
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState({ status: "error", message: String(payload.error || "候选金额导入失败") });
      return;
    }

    const result = payload as ImportResult;
    setState({
      status: "success",
      message: `已导入 ${result.candidateAmountCount ?? 0} 条候选金额，覆盖 ${result.rowCount ?? 0} 条候选行，跳过 ${result.skippedCount ?? 0} 条。币种：${result.currencies?.join(" / ") || "-"}。`
    });
  }

  if (!enabled) {
    return (
      <div className="stack" data-testid="finance-candidate-amount-import-disabled">
        <button className="button" type="button" disabled>候选金额导入暂未开放</button>
        <p className="muted">该入口受服务端 feature flag 控制。production 默认关闭。</p>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={handleSubmit} data-testid="finance-candidate-amount-import-form">
      <div className="notice warn-notice stack">
        <strong>候选金额不是正式报价。</strong>
        <p>候选金额不是 FinanceApprovedPrice，不能直接发客户。</p>
        <p>导入后默认仅财务可见，仍需要后续 FinancePricing / 财务审批 / 价格快照。</p>
      </div>

      <div className="checkbox-list">
        <label>
          <input
            type="checkbox"
            name="tradeModes"
            value="export_usd"
            checked={tradeModes.export_usd}
            onChange={(event) => setTradeModes((current) => ({ ...current, export_usd: event.target.checked }))}
          />
          外销 USD 候选来源
        </label>
        <label>
          <input
            type="checkbox"
            name="tradeModes"
            value="domestic_cny"
            checked={tradeModes.domestic_cny}
            onChange={(event) => setTradeModes((current) => ({ ...current, domestic_cny: event.target.checked }))}
          />
          内销 CNY 候选来源
        </label>
      </div>

      <button className="button" type="submit" disabled={!canSubmit}>
        {batchStatus === "finance_confirmed" ? "导入候选金额" : "仅 finance_confirmed 批次可导入"}
      </button>

      {state.status === "error" ? <p className="error">{state.message}</p> : null}
      {state.status === "success" ? <p className="success">{state.message}</p> : null}
      {state.status === "loading" ? <p className="muted">正在导入候选金额...</p> : null}
    </form>
  );
}
