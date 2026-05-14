import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { isFinanceQuoteSourceDryRunConfirmEnabled } from "@/lib/honoa/server/feature-flags";
import { quoteSourceUploadViewModel } from "@/lib/honoa/server/quote-source-upload";
import { confirmQuoteSourceUploadDryRun } from "@/lib/honoa/server/quote-source-upload-dry-run-confirmation";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!isFinanceQuoteSourceDryRunConfirmEnabled()) {
    return NextResponse.json({ error: "dry-run 确认暂未开放。" }, { status: 403 });
  }

  try {
    const { uploadId } = await params;
    const result = await confirmQuoteSourceUploadDryRun(actor, uploadId);
    return NextResponse.json({
      upload: quoteSourceUploadViewModel(result.upload),
      stagingBatch: {
        id: result.stagingBatch.id,
        sourceFileName: result.stagingBatch.sourceFileName,
        adapterId: result.stagingBatch.adapterId,
        category: result.stagingBatch.category,
        status: result.stagingBatch.status,
        dryRunDecisionStatus: result.stagingBatch.dryRunDecisionStatus
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "dry-run 确认失败。";
    const status = message.includes("不能") || message.includes("当前账号") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
