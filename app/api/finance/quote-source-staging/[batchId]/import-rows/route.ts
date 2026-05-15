import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { isFinanceQuoteSourceRowImportEnabled } from "@/lib/honoa/server/feature-flags";
import { importQuoteSourceRows } from "@/lib/honoa/server/quote-source-row-import";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!isFinanceQuoteSourceRowImportEnabled()) {
    return NextResponse.json({ error: "财务报价表 row import 暂未开放。" }, { status: 403 });
  }

  try {
    const { batchId } = await params;
    const result = await importQuoteSourceRows(actor, { batchId });
    return NextResponse.json({
      batchId,
      rowCount: result.rows.length,
      candidateRows: result.auditMetadata.candidateRows,
      needsManualReviewRows: result.auditMetadata.needsManualReviewRows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "财务报价表 row import 执行失败。";
    const status = message.includes("不能") || message.includes("当前账号") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
