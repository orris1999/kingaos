import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { prisma } from "@/lib/honoa/server/db";
import { assertCanManageQuoteSourceUpload } from "@/lib/honoa/server/quote-source-upload";
import { generateQuoteSourceUploadPutSignedUrl, isOssConfigured, validateQuoteSourceUploadRequest } from "@/lib/honoa/server/oss";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    assertCanManageQuoteSourceUpload(actor);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "当前账号不能上传财务报价表。" }, { status: 403 });
  }
  if (!isOssConfigured()) {
    return NextResponse.json({ error: "OSS 尚未配置，暂时不能上传文件。请联系管理员配置阿里云 OSS。" }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  try {
    const input = {
      fileName: String((body as Record<string, unknown>).fileName || ""),
      fileSize: Number((body as Record<string, unknown>).fileSize || 0),
      mimeType: String((body as Record<string, unknown>).mimeType || "")
    };
    validateQuoteSourceUploadRequest(input);
    const signed = generateQuoteSourceUploadPutSignedUrl(input);
    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "quote_source_upload.upload_url.generate",
        entityType: "QuoteSourceUpload",
        entityId: null,
        metadata: {
          sourceFileName: signed.sourceFileName,
          storageProvider: "aliyun_oss",
          storageKey: signed.objectKey,
          fileSize: signed.fileSize,
          uploadedByUserId: actor.id
        }
      }
    });
    return NextResponse.json(signed);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "报价表上传地址生成失败。" }, { status: 400 });
  }
}
