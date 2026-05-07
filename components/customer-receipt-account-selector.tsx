"use client";

import { useMemo, useState } from "react";
import { receiptAccountPaymentMethodLabel } from "@/lib/honoa/shared/constants";

export type ReceiptAccountOption = {
  id: string;
  accountCode?: string | null;
  displayName: string;
  scenarioName?: string | null;
  paymentMethod?: string | null;
  currency: string;
  companyName: string;
  accountNo: string;
  bankName: string;
  swiftCode?: string | null;
  bankAddress?: string | null;
  usageNotes?: string | null;
  riskNotes?: string | null;
  isActive: boolean;
  disabledAt?: string | null;
  disabledReason?: string | null;
  updatedAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function CustomerReceiptAccountSelector({
  accounts,
  selectedAccountId,
  selectedNote,
  canSelect
}: {
  accounts: ReceiptAccountOption[];
  selectedAccountId?: string | null;
  selectedNote?: string | null;
  canSelect: boolean;
}) {
  const [value, setValue] = useState(selectedAccountId || "");
  const selected = useMemo(() => accounts.find((account) => account.id === value) || null, [accounts, value]);
  const activeAccounts = accounts.filter((account) => account.isActive);

  return (
    <div className="subpanel stack" style={{ gridColumn: "1 / -1" }}>
      <h3>默认收款方案</h3>
      {!canSelect ? <p className="muted">当前账号不能选择默认收款方案。</p> : null}
      {activeAccounts.length === 0 ? <p className="warn-text">暂无有效官方收款账号，请先由财务维护。</p> : null}
      <label>
        选择默认收款方案
        <select name="defaultReceiptAccountId" value={value} disabled={!canSelect} onChange={(event) => setValue(event.target.value)}>
          <option value="">暂不设置默认收款方案</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id} disabled={!account.isActive && account.id !== selectedAccountId}>
              {account.displayName} / {account.currency}{account.scenarioName ? ` / ${account.scenarioName}` : ""}{account.isActive ? "" : "（已停用）"}
            </option>
          ))}
        </select>
      </label>
      <label>
        收款方案备注
        <textarea name="defaultReceiptAccountNote" defaultValue={selectedNote || ""} disabled={!canSelect} placeholder="可记录为什么该客户默认使用此官方收款方案。" />
      </label>
      {!selected ? <p className="muted">未设置默认收款方案，未来合同可能需要重新选择。</p> : null}
      {selected ? (
        <div className="readonly-panel receipt-account-panel" data-testid="readonly-field">
          <div className="receipt-account-summary">
            <div>
              <b>收款方案</b>
              <span>{selected.displayName}{selected.accountCode ? ` / ${selected.accountCode}` : ""}</span>
            </div>
            <span className={selected.isActive ? "tag ok" : "tag warn"}>{selected.isActive ? "有效" : "已停用"}</span>
          </div>
          <p className="tiny muted">财务维护，业务只读。</p>
          {!selected.isActive ? (
            <p className="warn-text">该收款账号已停用，请重新选择有效账号。</p>
          ) : null}
          {!selected.isActive ? (
            <p className="tiny muted">原收款方案：{selected.displayName}{selected.accountCode ? ` / ${selected.accountCode}` : ""}</p>
          ) : null}
          <details className="receipt-account-details">
            <summary>查看官方账号详情</summary>
            <div className="detail-grid">
              <div className="kv"><b>收款场景</b><span>{selected.scenarioName || "-"}</span></div>
              <div className="kv"><b>支付方式</b><span>{receiptAccountPaymentMethodLabel(selected.paymentMethod)}</span></div>
              <div className="kv"><b>币种</b><span>{selected.currency}</span></div>
              <div className="kv"><b>收款主体</b><span>{selected.companyName}</span></div>
              <div className="kv"><b>账号</b><span>{selected.accountNo}</span></div>
              <div className="kv"><b>开户行</b><span>{selected.bankName}</span></div>
              <div className="kv"><b>SWIFT CODE</b><span>{selected.swiftCode || "-"}</span></div>
              <div className="kv"><b>银行地址</b><span>{selected.bankAddress || "-"}</span></div>
              {!selected.isActive ? <div className="kv"><b>停用时间</b><span>{selected.disabledAt ? formatDate(selected.disabledAt) : "-"}</span></div> : null}
              {!selected.isActive ? <div className="kv"><b>停用原因</b><span className="warn-text">{selected.disabledReason || "-"}</span></div> : null}
              <div className="kv"><b>财务最后更新时间</b><span>{formatDate(selected.updatedAt)}</span></div>
              <div className="kv"><b>使用说明</b><span>{selected.usageNotes || "-"}</span></div>
              <div className="kv"><b>风险提醒</b><span>{selected.riskNotes || "-"}</span></div>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
