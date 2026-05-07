import Link from "next/link";
import { ReceiptAccountDisableForm } from "@/components/receipt-account-disable-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { disableReceiptAccountAction, enableReceiptAccountAction, getReceiptAccountForActor, getReceiptAccountImpactSummary } from "@/lib/honoa/server/receipt-accounts";
import { customerCompanyDisplay, customerStatusLabel, receiptAccountPaymentMethodLabel } from "@/lib/honoa/shared/constants";
import { customerGeoDisplay } from "@/lib/honoa/shared/geo";

function formatDate(value?: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

export default async function ReceiptAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  try {
    const [account, impact] = await Promise.all([
      getReceiptAccountForActor(user, id),
      getReceiptAccountImpactSummary(user, id)
    ]);
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
          <section className="panel stack" id="using-customers">
            <div className="split">
              <div>
                <h2>正在使用该账号的客户</h2>
                <p className="muted">共 {impact.affectedCustomerCount} 个客户档案引用该官方收款账号。财务人员可查看有限客户摘要；能否进入客户详情继续按客户权限判断。</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>客户编号</th><th>公司名称</th><th>负责人</th><th>客户状态</th><th>国家 / 地区</th><th>州 / 省</th><th>城市</th><th>最近更新时间</th><th>收款账号状态</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {impact.customers.length === 0 ? <tr><td colSpan={10}>暂无客户引用该账号</td></tr> : impact.customers.map((customer) => {
                    const geo = customerGeoDisplay(customer);
                    return (
                      <tr key={customer.id}>
                        <td>{customer.customerCode}</td>
                        <td>{customerCompanyDisplay(customer)}</td>
                        <td>{customer.ownerName}</td>
                        <td>{customerStatusLabel(customer.status)}</td>
                        <td>{geo.country || "-"}</td>
                        <td>{geo.state || "-"}</td>
                        <td>{geo.city || "-"}</td>
                        <td>{formatDate(customer.updatedAt)}</td>
                        <td><span className={account.isActive ? "tag ok" : "tag warn"}>{account.isActive ? "有效" : "已停用"}</span></td>
                        <td>{customer.canOpenCustomer ? <Link href={`/export/customers/${customer.id}`}>查看客户</Link> : <span className="muted">无客户详情权限</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {canManage ? (
            <section className="panel stack">
              {account.isActive ? (
                <ReceiptAccountDisableForm action={disableReceiptAccountAction.bind(null, account.id)} affectedCustomerCount={impact.affectedCustomerCount} />
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
