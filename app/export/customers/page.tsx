import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer, listExportCustomersForActor, primaryContactSummary } from "@/lib/honoa/server/customers";
import { customerGeoDisplay } from "@/lib/honoa/shared/geo";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireCurrentUser();
  if (!hasAnyServerPermission(user, ["export.customers.view_own", "export.customers.view_all"])) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看出口部客户档案。" />
      </KingaShell>
    );
  }
  const { q = "" } = await searchParams;
  const customers = await listExportCustomersForActor(user, q);
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
        <form className="panel" action="/export/customers">
          <label>搜索客户<input name="q" defaultValue={q} placeholder="客户编号、名称、地址、状态、负责人" /></label>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>客户编号</th><th>客户名称</th><th>客户类型</th><th>地址</th><th>客户状态</th><th>重复标记</th><th>负责业务员</th><th>主要联系人</th><th>联系电话</th><th>邮箱</th><th>最近更新时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {customers.length === 0 ? <tr><td colSpan={12}>暂无客户</td></tr> : customers.map((customer) => {
                const contact = primaryContactSummary(customer);
                const geo = customerGeoDisplay(customer);
                return (
                  <tr key={customer.id}>
                    <td>{customer.customerCode}</td>
                    <td>{customer.name}</td>
                    <td>{customer.customerType}</td>
                    <td>{geo.full}</td>
                    <td>{customer.status}</td>
                    <td>{customer.duplicateApprovalStatus === "approved_duplicate" ? <span className="tag warn">重复客户例外</span> : "-"}</td>
                    <td>{customer.ownerName}</td>
                    <td>{contact?.name || "-"}</td>
                    <td>{contact?.phone || "-"}</td>
                    <td>{contact?.email || "-"}</td>
                    <td>{formatDate(customer.updatedAt)}</td>
                    <td className="actions">
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
