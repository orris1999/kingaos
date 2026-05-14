import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { QuoteDraftWorkbench } from "@/components/quote-draft-workbench";
import { findExportQuoteDraftSourceCandidatesAction } from "@/lib/honoa/quote-draft/export-staging-consumption-actions";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { isExportQuoteDraftExcelEnabled, isExportStagingQuoteDraftEnabled } from "@/lib/honoa/server/feature-flags";

export default async function ExportQuoteDraftWorkbenchPage() {
  const user = await requireCurrentUser();
  const stagingCandidatesEnabled = isExportStagingQuoteDraftEnabled();
  const excelExportEnabled = isExportQuoteDraftExcelEnabled();
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
            <p className="muted">
              出口部内部 Workbench，默认只使用 mock catalog；feature flag 开启后可只读查询财务确认 staging 候选。
            </p>
          </div>
          <span className="tag warn">内部原型</span>
        </section>
        <QuoteDraftWorkbench
          stagingCandidatesEnabled={stagingCandidatesEnabled}
          excelExportEnabled={excelExportEnabled}
          findStagingCandidatesAction={
            stagingCandidatesEnabled ? findExportQuoteDraftSourceCandidatesAction : undefined
          }
        />
      </div>
    </KingaShell>
  );
}
