import Link from "next/link";
import { DisabledCard, Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function ExportPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "export.dashboard.view")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能进入出口部页面。" />
      </KingaShell>
    );
  }
  const canCustomers = hasAnyServerPermission(user, ["export.customers.view_own", "export.customers.view_all"]);
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / 出口部</div>
          <h1>出口部</h1>
          <p className="muted">出口部当前只开放客户档案。查询价格功能未来由财务部统一维护价格表后开放，出口部只能查询财务确认后的价格，不能修改价格。</p>
        </div>
        <section className="grid">
          {canCustomers ? (
            <Link className="card open" href="/export/customers">
              <h2>客户档案</h2>
              <p className="muted">查看、新建、编辑出口部客户。</p>
              <span className="tag ok">已开放</span>
            </Link>
          ) : <DisabledCard title="客户档案" description="需要客户档案查看权限" />}
          {user.role === "super_admin" ? (
            <Link className="card open" href="/export/quote-draft-workbench">
              <h2>报价草稿 Workbench</h2>
              <p className="muted">内部 mock 解析器演示，不读取真实报价表，不生成正式报价。</p>
              <span className="tag warn">内部原型</span>
            </Link>
          ) : <DisabledCard title="报价草稿 Workbench" description="内部原型，暂仅 super_admin 可访问" />}
          <DisabledCard title="查询价格" description="暂未开放，未来由财务部价格域确认后开放" />
        </section>
      </div>
    </KingaShell>
  );
}
