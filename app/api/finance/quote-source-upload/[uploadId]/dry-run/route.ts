import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { isFinanceQuoteSourceDryRunEnabled } from "@/lib/honoa/server/feature-flags";
import { runQuoteSourceUploadDryRun } from "@/lib/honoa/server/quote-source-upload-dry-run";
import { quoteSourceUploadViewModel } from "@/lib/honoa/server/quote-source-upload";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!isFinanceQuoteSourceDryRunEnabled()) {
    return NextResponse.json({ error: "财务报价表 dry-run 暂未开放。" }, { status: 403 });
  }

  try {
    const { uploadId } = await params;
    const result = await runQuoteSourceUploadDryRun(actor, uploadId);
    return NextResponse.json({
      upload: quoteSourceUploadViewModel(result.upload)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "财务报价表 dry-run 执行失败。";
    const status = message.includes("不能") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
