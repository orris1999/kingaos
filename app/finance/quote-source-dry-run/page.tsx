import { FinanceQuoteSourceDryRun } from "@/components/finance-quote-source-dry-run";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function FinanceQuoteSourceDryRunPage() {
  const user = await requireCurrentUser();

  if (user.role !== "super_admin") {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看 Finance 报价表 dry-run。" />
      </KingaShell>
    );
  }

  return (
    <KingaShell user={user}>
      <div className="stack">
        <div className="page-hero">
          <div>
            <div className="breadcrumbs">KingaOS / 财务部 / 报价表 dry-run</div>
            <h1>Finance 报价表 dry-run</h1>
            <p className="muted">
              本页面只做浏览器本地结构识别，不上传文件、不写数据库、不生成报价草稿或正式报价。
            </p>
          </div>
          <span className="tag warn">内部测试</span>
        </div>

        <FinanceQuoteSourceDryRun />
      </div>
    </KingaShell>
  );
}
