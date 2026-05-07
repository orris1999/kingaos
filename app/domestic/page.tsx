import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { canAccessDomesticDashboard, DOMESTIC_MODULE_STATUS } from "@/lib/honoa/server/domestic-access";
import { requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function DomesticPage() {
  const user = await requireCurrentUser();
  if (!canAccessDomesticDashboard(user)) {
    return (
      <KingaShell user={user}>
        <Forbidden message="国内部当前未开放。" />
      </KingaShell>
    );
  }

  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / 国内部</div>
          <h1>国内部</h1>
          <p className="muted">当前状态：{DOMESTIC_MODULE_STATUS === "not_open" ? "未开放" : "已开放"}</p>
          <p className="muted">国内部功能暂未开放。</p>
          <p className="muted">当前 Task 001A 仅完成入口安全加固和访问门禁，不开放任何业务功能。</p>
        </div>
        <section className="grid">
          {["国内客户档案", "销售数据导入 / 快照", "客户季度考评", "客户政策申请预审"].map((module) => (
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
