import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { getCustomerAttachmentDownloadUrl } from "@/lib/honoa/server/customers";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ customerId: string; attachmentId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { customerId, attachmentId } = await params;
  try {
    return NextResponse.json(await getCustomerAttachmentDownloadUrl(actor, customerId, attachmentId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "附件下载地址生成失败。";
    const status = message.includes("不能") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
