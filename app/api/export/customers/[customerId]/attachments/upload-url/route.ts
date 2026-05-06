import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer } from "@/lib/honoa/server/customers";
import { prisma } from "@/lib/honoa/server/db";
import { generatePutSignedUrl, isOssConfigured, validateOssUploadRequest } from "@/lib/honoa/server/oss";
import { CUSTOMER_ATTACHMENT_TYPES } from "@/lib/honoa/shared/constants";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { customerId } = await params;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !canEditCustomerServer(actor, customer)) {
    return NextResponse.json({ error: "当前账号不能维护该客户附件。" }, { status: 403 });
  }
  if (!isOssConfigured()) {
    return NextResponse.json({ error: "OSS 尚未配置，暂时只能添加附件链接。" }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  const attachmentType = String(body.attachmentType || "其他");
  if (!CUSTOMER_ATTACHMENT_TYPES.includes(attachmentType)) {
    return NextResponse.json({ error: "附件类型无效。" }, { status: 400 });
  }
  try {
    const input = {
      fileName: String(body.fileName || ""),
      fileSize: Number(body.fileSize || 0),
      mimeType: String(body.mimeType || "")
    };
    validateOssUploadRequest(input);
    const signed = generatePutSignedUrl(customerId, input);
    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_attachment.upload_url.generate",
        entityType: "Customer",
        entityId: customerId,
        metadata: {
          customerId,
          attachmentName: String(body.fileName || ""),
          attachmentType,
          storageProvider: "aliyun_oss",
          storageKey: signed.objectKey,
          fileSize: signed.fileSize,
          mimeType: signed.mimeType
        }
      }
    });
    return NextResponse.json(signed);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "附件上传地址生成失败。" }, { status: 400 });
  }
}
