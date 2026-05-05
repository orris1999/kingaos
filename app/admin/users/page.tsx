import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { listUsersForActor } from "@/lib/honoa/server/users";
import { DEPARTMENT_LABELS, ROLE_LABELS } from "@/lib/honoa/shared/constants";

function formatDate(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

export default async function UsersPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "users.view")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号没有用户查看权限。" />
      </KingaShell>
    );
  }
  const users = await listUsersForActor(user);
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div className="split">
          <div>
            <div className="breadcrumbs">KingaOS / Admin / 用户管理</div>
            <h1>用户管理</h1>
          </div>
          {hasServerPermission(user, "users.create") ? <Link className="button" href="/admin/users/new">新建用户</Link> : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>姓名</th><th>邮箱</th><th>部门</th><th>角色</th><th>状态</th><th>创建时间</th><th>最近登录时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{DEPARTMENT_LABELS[item.department as keyof typeof DEPARTMENT_LABELS]}</td>
                  <td>{ROLE_LABELS[item.role as keyof typeof ROLE_LABELS]}</td>
                  <td>{item.isActive ? <span className="tag ok">启用</span> : <span className="tag danger">停用</span>}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{formatDate(item.lastLoginAt)}</td>
                  <td><Link href={`/admin/users/${item.id}/edit`}>编辑</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </KingaShell>
  );
}
