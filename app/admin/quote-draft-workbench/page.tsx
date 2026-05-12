import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { QuoteDraftWorkbench } from "@/components/quote-draft-workbench";
import { requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function AdminQuoteDraftWorkbenchPage() {
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
            <div className="breadcrumbs">KingaOS / Admin / 报价草稿解析器 Workbench</div>
            <h1>报价草稿解析器 Workbench</h1>
            <p className="muted">仅用于内部测试，当前使用 mock 数据，不读取真实报价表。</p>
          </div>
          <span className="tag warn">super_admin only</span>
        </section>
        <QuoteDraftWorkbench />
      </div>
    </KingaShell>
  );
}
