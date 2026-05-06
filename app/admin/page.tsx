import Link from "next/link";
import { DisabledCard, Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasAnyServerPermission, hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function AdminPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "admin.dashboard.view")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号没有 admin 首页权限。" />
      </KingaShell>
    );
  }
  const canExport = hasAnyServerPermission(user, ["export.dashboard.view", "export.customers.view_all", "export.customers.view_own"]);
  const canFinance = hasAnyServerPermission(user, ["finance.dashboard.view", "finance.receipt_accounts.view", "finance.receipt_accounts.manage"]);
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / Admin</div>
          <h1>系统管理入口</h1>
          <p className="muted">当前只开放账号权限管理和出口部客户档案，其他模块只保留入口。</p>
        </div>
        <section className="grid">
          {hasServerPermission(user, "users.view") ? (
            <Link className="card open" href="/admin/users">
              <h2>用户管理</h2>
              <p className="muted">新建、编辑、启用 / 停用用户，重置密码。</p>
              <span className="tag ok">已开放</span>
            </Link>
          ) : <DisabledCard title="用户管理" description="需要 users.view 权限" />}
          {hasServerPermission(user, "permissions.manage") ? (
            <Link className="card open" href="/admin/permissions">
              <h2>权限管理</h2>
              <p className="muted">按用户维护最小权限。</p>
              <span className="tag ok">已开放</span>
            </Link>
          ) : <DisabledCard title="权限管理" description="需要 permissions.manage 权限" />}
          {canExport ? (
            <Link className="card open" href="/export">
              <h2>出口部</h2>
              <p className="muted">客户档案已开放，查询价格暂未开放。</p>
              <span className="tag ok">部分开放</span>
            </Link>
          ) : <DisabledCard title="出口部" description="需要出口部权限" />}
          <DisabledCard title="国内部" description="功能暂未开放" />
          <DisabledCard title="技术部" description="功能暂未开放" />
          {canFinance ? (
            <Link className="card open" href="/finance">
              <h2>财务部</h2>
              <p className="muted">收款账号管理已开放；价格管理功能暂未开放。</p>
              <span className="tag ok">部分开放</span>
            </Link>
          ) : <DisabledCard title="财务部" description="需要财务部入口或收款账号权限" />}
        </section>
      </div>
    </KingaShell>
  );
}
