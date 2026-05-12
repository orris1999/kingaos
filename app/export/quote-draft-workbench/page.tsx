import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { QuoteDraftWorkbench } from "@/components/quote-draft-workbench";
import { requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function ExportQuoteDraftWorkbenchPage() {
  const user = await requireCurrentUser();
  if (user.role !== "super_admin") {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看报价草稿解析器 Workbench。" />
      </KingaShell>
    );
  }

  return (
    <KingaShell user={user}>
      <div className="stack">
        <section className="page-hero">
          <div>
            <div className="breadcrumbs">KingaOS / 出口部 / 报价草稿解析器 Workbench</div>
            <h1>报价草稿解析器 Workbench</h1>
            <p className="muted">出口部内部 mock 原型，只演示报价草稿解析动作，不读取真实报价表。</p>
          </div>
          <span className="tag warn">内部原型</span>
        </section>
        <QuoteDraftWorkbench />
      </div>
    </KingaShell>
  );
}
