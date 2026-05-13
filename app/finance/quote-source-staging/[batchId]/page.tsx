import {
  FinanceQuoteSourceStagingDetail,
  type QuoteSourceStagingDetailData,
  type QuoteSourceStagingDetailRow
} from "@/components/finance-quote-source-staging-detail";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { prisma } from "@/lib/honoa/server/db";
import { isFinanceStagingConfirmEnabled } from "@/lib/honoa/server/feature-flags";
import type { Prisma } from "@prisma/client";

type QuoteSourceStagingBatchWithRows = Prisma.QuoteSourceStagingBatchGetPayload<{
  include: { rows: true };
}>;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapRow(row: {
  id: string;
  sourceRowNumber: number | null;
  rawKjCode: string | null;
  standardKjCode: string | null;
  productNameCandidate: string | null;
  category: string | null;
  priceCandidateStatus: string;
  visibility: string;
  rowStatus: string;
  warnings: unknown;
}): QuoteSourceStagingDetailRow {
  return {
    id: row.id,
    sourceRowNumber: row.sourceRowNumber ?? undefined,
    rawKjCode: row.rawKjCode ?? undefined,
    standardKjCode: row.standardKjCode ?? undefined,
    productNameCandidate: row.productNameCandidate ?? undefined,
    category: row.category ?? undefined,
    priceCandidateStatus: row.priceCandidateStatus,
    visibility: row.visibility,
    rowStatus: row.rowStatus,
    warnings: asStringArray(row.warnings)
  };
}

function mapBatch(batch: QuoteSourceStagingBatchWithRows | null): QuoteSourceStagingDetailData | null {
  if (!batch) {
    return null;
  }

  return {
    id: batch.id,
    sourceFileName: batch.sourceFileName,
    adapterId: batch.adapterId,
    category: batch.category ?? "",
    dryRunDecisionStatus: batch.dryRunDecisionStatus,
    status: batch.status,
    submittedByRole: batch.submittedByRole,
    consumerDepartment: batch.consumerDepartment,
    createdByUserId: batch.createdByUserId ?? undefined,
    createdByName: batch.createdByName ?? undefined,
    createdAt: batch.createdAt.toISOString(),
    confirmedByUserId: batch.confirmedByUserId ?? undefined,
    confirmedByName: batch.confirmedByName ?? undefined,
    confirmedAt: batch.confirmedAt?.toISOString(),
    warnings: asStringArray(batch.warnings),
    notes: batch.notes ?? undefined,
    rows: batch.rows.map(mapRow)
  };
}

export default async function FinanceQuoteSourceStagingDetailPage({
  params
}: {
  params: Promise<{ batchId: string }>;
}) {
  const user = await requireCurrentUser();
  const { batchId } = await params;

  if (user.role !== "super_admin") {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看 Finance 报价表 staging。" />
      </KingaShell>
    );
  }

  const batch = await prisma.quoteSourceStagingBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        orderBy: [{ sourceRowNumber: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  const confirmationEnabled = isFinanceStagingConfirmEnabled();

  return (
    <KingaShell user={user}>
      <div className="stack">
        <div className="page-hero">
          <div>
            <div className="breadcrumbs">KingaOS / 财务部 / 报价表 staging / 批次详情</div>
            <h1>报价表 staging 批次详情</h1>
            <p className="muted">
              确认功能受服务端开关控制；默认生产关闭，不生成正式报价。
            </p>
          </div>
          <span className="tag warn">只读预览</span>
        </div>

        <FinanceQuoteSourceStagingDetail
          batch={mapBatch(batch)}
          confirmationEnabled={confirmationEnabled}
        />
      </div>
    </KingaShell>
  );
}
