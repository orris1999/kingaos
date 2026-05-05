import { KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import type { Department, PermissionKey } from "@/lib/honoa/shared/domain-types";

const departmentEntryPermissions: Partial<Record<Department, PermissionKey>> = {
  domestic: "domestic.dashboard.view",
  technical: "technical.dashboard.view",
  finance: "finance.dashboard.view",
  export: "export.dashboard.view"
};

export async function UnavailablePage({
  title,
  description,
  modules,
  department
}: {
  title: string;
  description: string;
  modules: string[];
  department?: Department;
}) {
  const user = await requireCurrentUser();
  if (
    department &&
    user.department !== department &&
    !hasServerPermission(user, "departments.view_all") &&
    !(departmentEntryPermissions[department] && hasServerPermission(user, departmentEntryPermissions[department]))
  ) {
    return (
      <KingaShell user={user}>
        <div className="panel stack">
          <h1>没有权限</h1>
          <p className="muted">当前账号不能进入该部门入口。</p>
        </div>
      </KingaShell>
    );
  }
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / {title}</div>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
        <section className="grid">
          {modules.map((module) => (
            <div className="card disabled" key={module}>
              <h2>{module}</h2>
              <p className="muted">暂未开放</p>
              <span className="tag warn">不可进入</span>
            </div>
          ))}
        </section>
      </div>
    </KingaShell>
  );
}
