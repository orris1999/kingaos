import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { assertNoQuoteSourceUploadSensitiveFields, createQuoteSourceUploadMetadata } from "@/lib/honoa/server/quote-source-upload";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  const payload = body as Record<string, unknown>;
  try {
    assertNoQuoteSourceUploadSensitiveFields(payload);
    const upload = await createQuoteSourceUploadMetadata(actor, {
      sourceFileName: String(payload.sourceFileName || ""),
      originalFileName: String(payload.originalFileName || payload.sourceFileName || ""),
      objectKey: String(payload.objectKey || ""),
      mimeType: String(payload.mimeType || ""),
      fileSize: Number(payload.fileSize || 0),
      adapterId: String(payload.adapterId || ""),
      category: String(payload.category || ""),
      notes: String(payload.notes || ""),
      warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : undefined
    });
    return NextResponse.json({ upload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "报价表上传记录保存失败。";
    const status = message.includes("不能") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
