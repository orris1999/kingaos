import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { createCustomerAttachmentFromOss } from "@/lib/honoa/server/customers";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { customerId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  try {
    const attachment = await createCustomerAttachmentFromOss(actor, customerId, {
      attachmentName: String(body.attachmentName || ""),
      attachmentType: String(body.attachmentType || "其他"),
      fieldKey: String(body.fieldKey || ""),
      fieldLabel: String(body.fieldLabel || ""),
      objectKey: String(body.objectKey || ""),
      mimeType: String(body.mimeType || ""),
      fileSize: Number(body.fileSize || 0),
      description: String(body.description || "")
    });
    return NextResponse.json({ attachment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "附件保存失败。";
    const status = message.includes("不能") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
