import type { User, UserPermission } from "@prisma/client";
import { createUserAction, updateUserAction } from "@/lib/honoa/server/users";
import type { AuthUser } from "@/lib/honoa/server/auth";
import { hasServerPermission } from "@/lib/honoa/server/auth";
import { DEPARTMENT_LABELS, PERMISSION_GROUPS, ROLE_LABELS } from "@/lib/honoa/shared/constants";

const departments = Object.keys(DEPARTMENT_LABELS);
const roles = Object.keys(ROLE_LABELS);

export function ServerUserForm({
  actor,
  target
}: {
  actor: AuthUser;
  target?: User & { permissions: UserPermission[] };
}) {
  const selectedPermissions = new Set(target?.permissions.map((item) => item.permissionKey) || []);
  const canManagePermissions = hasServerPermission(actor, "permissions.manage");
  const canDisable = hasServerPermission(actor, "users.disable");
  const action = target ? updateUserAction.bind(null, target.id) : createUserAction;
  return (
    <form className="stack" action={action}>
      <div>
        <div className="breadcrumbs">KingaOS / Admin / 用户管理 / {target ? "编辑用户" : "新建用户"}</div>
        <h1>{target ? `编辑用户：${target.name}` : "新建用户"}</h1>
      </div>
      <section className="panel form-grid">
        <label>姓名<input name="name" defaultValue={target?.name || ""} required /></label>
        <label>邮箱<input name="email" type="email" defaultValue={target?.email || ""} required /></label>
        <label>{target ? "重置密码" : "初始密码"}<input name="password" type="password" required={!target} placeholder={target ? "留空则不修改" : ""} /></label>
        <label>
          部门
          <select name="department" defaultValue={target?.department || "export"}>
            {departments.map((department) => <option key={department} value={department}>{DEPARTMENT_LABELS[department as keyof typeof DEPARTMENT_LABELS]}</option>)}
          </select>
        </label>
        <label>
          角色
          <select name="role" defaultValue={target?.role || "staff"}>
            {roles.map((role) => <option key={role} value={role} disabled={role === "super_admin" && actor.role !== "super_admin"}>{ROLE_LABELS[role as keyof typeof ROLE_LABELS]}</option>)}
          </select>
        </label>
        <label className="checkrow" style={{ alignSelf: "end" }}>
          <input name="isActive" type="checkbox" value="1" defaultChecked={target?.isActive ?? true} disabled={!canDisable} />
          <span>账号启用</span>
        </label>
      </section>
      <div>
        <h2>权限</h2>
        <p className="muted">未开放模块的权限只是预留，不代表真实功能开放。</p>
      </div>
      {PERMISSION_GROUPS.map((group) => (
        <section className="panel" key={group.group}>
          <h2>{group.group}</h2>
          {group.reserved ? <p className="muted">该模块权限已预留，但功能暂未开放。</p> : null}
          <div className="checkbox-grid">
            {group.items.map(([key, label]) => (
              <label className="checkrow" key={key}>
                <input type="checkbox" name="permissions" value={key} defaultChecked={selectedPermissions.has(key)} disabled={!canManagePermissions} />
                <span>{label}<br /><span className="tiny muted">{key}</span></span>
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="actions">
        <button type="submit">{target ? "保存修改" : "创建用户"}</button>
        <a className="button ghost" href="/admin/users">返回列表</a>
      </div>
    </form>
  );
}
