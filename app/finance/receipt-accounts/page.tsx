import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { listReceiptAccountsForActor } from "@/lib/honoa/server/receipt-accounts";
import { receiptAccountPaymentMethodLabel } from "@/lib/honoa/shared/constants";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

export default async function ReceiptAccountsPage() {
  const user = await requireCurrentUser();
  try {
    const accounts = await listReceiptAccountsForActor(user, true);
    const canManage = hasServerPermission(user, "finance.receipt_accounts.manage");
    return (
      <KingaShell user={user}>
        <div className="stack">
          <div className="split">
            <div>
              <div className="breadcrumbs">KingaOS / 财务部 / 收款账号管理</div>
              <h1>官方收款账号</h1>
              <p className="muted">财务维护官方账号；业务员只能在客户档案中选择收款方案，不能手填银行账号。</p>
            </div>
            <div className="actions">
              {canManage ? <Link className="button" href="/finance/receipt-accounts/new">新增收款账号</Link> : null}
              <Link className="button ghost" href="/finance">返回财务部</Link>
            </div>
          </div>
          <section className="panel table-wrap">
            <table>
              <thead>
                <tr><th>账号编号</th><th>方案名称</th><th>收款场景</th><th>币种</th><th>支付方式</th><th>开户行</th><th>使用客户数</th><th>状态</th><th>最近更新时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? <tr><td colSpan={10}>暂无官方收款账号</td></tr> : accounts.map((account) => {
                  const usingCustomerCount = account._count.customers;
                  return (
                    <tr key={account.id}>
                      <td>{account.accountCode}</td>
                      <td>{account.displayName}</td>
                      <td>{account.scenarioName || "-"}</td>
                      <td>{account.currency}</td>
                      <td>{receiptAccountPaymentMethodLabel(account.paymentMethod)}</td>
                      <td>{account.bankName}</td>
                      <td>
                        <Link href={`/finance/receipt-accounts/${account.id}#using-customers`}>{usingCustomerCount}</Link>
                        {!account.isActive && usingCustomerCount > 0 ? <div className="tiny warn-text">已停用，仍有 {usingCustomerCount} 个客户引用</div> : null}
                      </td>
                      <td><span className={account.isActive ? "tag ok" : "tag warn"}>{account.isActive ? "有效" : "已停用"}</span></td>
                      <td>{formatDate(account.updatedAt)}</td>
                      <td className="actions">
                        <Link href={`/finance/receipt-accounts/${account.id}`}>查看</Link>
                        {canManage ? <Link href={`/finance/receipt-accounts/${account.id}/edit`}>编辑</Link> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
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
