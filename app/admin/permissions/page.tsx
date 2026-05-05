import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { prisma } from "@/lib/honoa/server/db";
import { ROLE_LABELS } from "@/lib/honoa/shared/constants";

export default async function PermissionsPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "permissions.manage")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号没有权限管理权限。" />
      </KingaShell>
    );
  }
  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, include: { permissions: true } });
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / Admin / 权限管理</div>
          <h1>权限管理</h1>
          <p className="muted">权限编辑集成在用户编辑页面。国内部、技术部、财务部权限已预留，但功能暂未开放。</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>姓名</th><th>邮箱</th><th>角色</th><th>权限</th><th>操作</th></tr></thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{ROLE_LABELS[item.role as keyof typeof ROLE_LABELS]}</td>
                  <td>{item.role === "super_admin" ? "全部当前权限" : `${item.permissions.length} 项`}</td>
                  <td><Link href={`/admin/users/${item.id}/edit`}>设置权限</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </KingaShell>
  );
}
