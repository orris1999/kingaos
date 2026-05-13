import Link from "next/link";
import {
  FinanceQuoteSourceStagingList,
  type QuoteSourceStagingListItem
} from "@/components/finance-quote-source-staging-list";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { prisma } from "@/lib/honoa/server/db";

function mapBatch(item: {
  id: string;
  sourceFileName: string;
  adapterId: string;
  category: string | null;
  dryRunDecisionStatus: string;
  status: string;
  submittedByRole: string;
  consumerDepartment: string;
  createdAt: Date;
}): QuoteSourceStagingListItem {
  return {
    id: item.id,
    sourceFileName: item.sourceFileName,
    adapterId: item.adapterId,
    category: item.category ?? "",
    dryRunDecisionStatus: item.dryRunDecisionStatus,
    status: item.status,
    submittedByRole: item.submittedByRole,
    consumerDepartment: item.consumerDepartment,
    createdAt: item.createdAt.toISOString()
  };
}

export default async function FinanceQuoteSourceStagingPage() {
  const user = await requireCurrentUser();

  if (user.role !== "super_admin") {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看 Finance 报价表 staging。" />
      </KingaShell>
    );
  }

  const batches = await prisma.quoteSourceStagingBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <KingaShell user={user}>
      <div className="stack">
        <div className="page-hero">
          <div>
            <div className="breadcrumbs">KingaOS / 财务部 / 报价表 staging</div>
            <h1>报价表 staging</h1>
            <p className="muted">当前页面只读，不执行确认，不生成正式报价。</p>
          </div>
          <div className="actions">
            <span className="tag warn">只读预览</span>
            <Link className="button ghost" href="/finance">返回财务部</Link>
          </div>
        </div>

        <FinanceQuoteSourceStagingList batches={batches.map(mapBatch)} />
      </div>
    </KingaShell>
  );
}
