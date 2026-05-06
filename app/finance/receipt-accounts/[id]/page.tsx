import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { disableReceiptAccountAction, enableReceiptAccountAction, getReceiptAccountForActor } from "@/lib/honoa/server/receipt-accounts";
import { receiptAccountPaymentMethodLabel } from "@/lib/honoa/shared/constants";

function formatDate(value?: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

export default async function ReceiptAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  try {
    const account = await getReceiptAccountForActor(user, id);
    const canManage = hasServerPermission(user, "finance.receipt_accounts.manage");
    return (
      <KingaShell user={user}>
        <div className="stack">
          <div className="split">
            <div>
              <div className="breadcrumbs">KingaOS / 财务部 / 收款账号管理 / 账号详情</div>
              <h1>{account.displayName}</h1>
              <p className="actions">
                <span className="tag">账号编号：{account.accountCode}</span>
                <span className={account.isActive ? "tag ok" : "tag warn"}>{account.isActive ? "有效" : "已停用"}</span>
              </p>
            </div>
            <div className="actions">
              {canManage ? <Link className="button" href={`/finance/receipt-accounts/${account.id}/edit`}>编辑收款账号</Link> : null}
              <Link className="button ghost" href="/finance/receipt-accounts">返回列表</Link>
            </div>
          </div>
          <section className="panel detail-grid">
            <div className="kv"><b>收款方案</b><span>{account.displayName}</span></div>
            <div className="kv"><b>收款场景</b><span>{account.scenarioName || "-"}</span></div>
            <div className="kv"><b>支付方式</b><span>{receiptAccountPaymentMethodLabel(account.paymentMethod)}</span></div>
            <div className="kv"><b>币种</b><span>{account.currency}</span></div>
            <div className="kv"><b>收款主体</b><span>{account.companyName}</span></div>
            <div className="kv"><b>账号</b><span>{account.accountNo}</span></div>
            <div className="kv"><b>开户行</b><span>{account.bankName}</span></div>
            <div className="kv"><b>SWIFT CODE</b><span>{account.swiftCode || "-"}</span></div>
            <div className="kv" style={{ gridColumn: "1 / -1" }}><b>银行地址</b><span>{account.bankAddress || "-"}</span></div>
            <div className="kv" style={{ gridColumn: "1 / -1" }}><b>使用说明</b><span>{account.usageNotes || "-"}</span></div>
            <div className="kv" style={{ gridColumn: "1 / -1" }}><b>风险提醒</b><span>{account.riskNotes || "-"}</span></div>
            <div className="kv"><b>生效日期</b><span>{formatDate(account.effectiveFrom)}</span></div>
            <div className="kv"><b>失效日期</b><span>{formatDate(account.effectiveTo)}</span></div>
            <div className="kv"><b>维护人</b><span>{account.maintainedByName || "-"}</span></div>
            <div className="kv"><b>更新时间</b><span>{formatDate(account.updatedAt)}</span></div>
            {!account.isActive ? <div className="kv" style={{ gridColumn: "1 / -1" }}><b>停用原因</b><span className="warn-text">{account.disabledReason || "-"}</span></div> : null}
          </section>
          {canManage ? (
            <section className="panel stack">
              {account.isActive ? (
                <form className="form-grid" action={disableReceiptAccountAction.bind(null, account.id)}>
                  <label style={{ gridColumn: "1 / -1" }}>停用原因<textarea name="disabledReason" required /></label>
                  <div><button className="ghost" type="submit">停用账号</button></div>
                </form>
              ) : (
                <form action={enableReceiptAccountAction.bind(null, account.id)}>
                  <button type="submit">启用账号</button>
                </form>
              )}
            </section>
          ) : null}
        </div>
      </KingaShell>
    );
  } catch (error) {
    return (
      <KingaShell user={user}>
        <Forbidden message={error instanceof Error ? error.message : "当前账号不能查看官方收款账号。"} />
      </KingaShell>
    );
  }
}
