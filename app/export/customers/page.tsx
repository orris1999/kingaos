import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer, listExportCustomersForActor, primaryContactSummary, type ReceiptAccountStatusFilter } from "@/lib/honoa/server/customers";
import { customerCompanyDisplay, customerStatusLabel, customerTypeValues } from "@/lib/honoa/shared/constants";
import { customerGeoDisplay } from "@/lib/honoa/shared/geo";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function CustomerTypeTags({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="muted">-</span>;
  return (
    <span className="tag-list-nowrap">
      {values.slice(0, 3).map((value) => <span className="tag" key={value}>{value}</span>)}
      {values.length > 3 ? <span className="tag">+{values.length - 3}</span> : null}
    </span>
  );
}

function receiptAccountStatusLabel(customer: { defaultReceiptAccountId?: string | null; defaultReceiptAccount?: { displayName: string; accountCode?: string | null; isActive: boolean } | null }) {
  if (!customer.defaultReceiptAccountId || !customer.defaultReceiptAccount) return <span className="muted">未设置</span>;
  return (
    <span className="receipt-account-compact">
      <span>{customer.defaultReceiptAccount.displayName}{customer.defaultReceiptAccount.accountCode ? ` / ${customer.defaultReceiptAccount.accountCode}` : ""}</span>
      <span className={customer.defaultReceiptAccount.isActive ? "tag ok" : "tag warn"}>{customer.defaultReceiptAccount.isActive ? "有效" : "已停用"}</span>
    </span>
  );
}

function parseReceiptAccountStatus(value?: string): ReceiptAccountStatusFilter {
  return value === "unset" || value === "active" || value === "inactive" ? value : "all";
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; receiptAccountStatus?: string }> }) {
  const user = await requireCurrentUser();
  if (!hasAnyServerPermission(user, ["export.customers.view_own", "export.customers.view_all"])) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看出口部客户档案。" />
      </KingaShell>
    );
  }
  const { q = "", receiptAccountStatus: receiptAccountStatusParam = "all" } = await searchParams;
  const receiptAccountStatus = parseReceiptAccountStatus(receiptAccountStatusParam);
  const customers = await listExportCustomersForActor(user, q, receiptAccountStatus);
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div className="split">
          <div>
            <div className="breadcrumbs">KingaOS / 出口部 / 客户档案</div>
            <h1>客户档案</h1>
          </div>
          <div className="actions">
            {hasServerPermission(user, "export.customers.create") ? <Link className="button" href="/export/customers/new">新建客户</Link> : null}
            {hasAnyServerPermission(user, ["export.customers.create", "export.customers.duplicate_review.view", "export.customers.duplicate_review.manage"]) ? <Link className="button ghost" href="/export/customers/duplicate-reviews">重复客户审核</Link> : null}
            {hasServerPermission(user, "export.customers.fields.manage") ? <Link className="button ghost" href="/export/customers/settings/fields">字段配置</Link> : null}
          </div>
        </div>
        <form className="panel customer-filter-bar" action="/export/customers">
          <label>搜索客户<input name="q" defaultValue={q} placeholder="搜索公司名称 / 客户编号 / 国家 / 负责人" /></label>
          <label>
            收款账号状态
            <select name="receiptAccountStatus" defaultValue={receiptAccountStatus}>
              <option value="all">全部</option>
              <option value="unset">未设置</option>
              <option value="active">有效</option>
              <option value="inactive">已停用</option>
            </select>
          </label>
          <div><button type="submit">筛选</button></div>
        </form>
        <div className="table-wrap customer-table-scroll" data-testid="customer-table-scroll">
          <table className="customer-table">
            <thead>
              <tr><th>客户编号</th><th>公司名称</th><th>客户类型</th><th>国家 / 地区</th><th>客户状态</th><th>默认收款方案</th><th>重复标记</th><th>负责人</th><th>主要联系人</th><th>最近更新时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {customers.length === 0 ? <tr><td colSpan={11}>暂无客户</td></tr> : customers.map((customer) => {
                const contact = primaryContactSummary(customer);
                const geo = customerGeoDisplay(customer);
                return (
                  <tr key={customer.id}>
                    <td>{customer.customerCode}</td>
                    <td className="customer-name-cell">{customerCompanyDisplay(customer)}</td>
                    <td><CustomerTypeTags values={customerTypeValues(customer)} /></td>
                    <td>{geo.country || "-"}</td>
                    <td>{customerStatusLabel(customer.status)}</td>
                    <td>{receiptAccountStatusLabel(customer)}</td>
                    <td>{customer.duplicateApprovalStatus === "approved_duplicate" ? <span className="tag warn">重复客户例外</span> : "-"}</td>
                    <td>{customer.ownerName}</td>
                    <td>{contact?.name || "-"}</td>
                    <td>{formatDate(customer.updatedAt)}</td>
                    <td className="actions action-cell">
                      <Link href={`/export/customers/${customer.id}`}>查看</Link>
                      {canEditCustomerServer(user, customer) ? <Link href={`/export/customers/${customer.id}/edit`}>编辑</Link> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </KingaShell>
  );
}
