import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { isFinanceQuoteCandidateAmountImportEnabled } from "@/lib/honoa/server/feature-flags";
import { importQuoteCandidateAmountsForBatch } from "@/lib/honoa/server/quote-candidate-amount-import";
import type { QuoteCandidateAmountTradeMode } from "@/lib/honoa/quote-draft";

export const runtime = "nodejs";

function normalizeTradeModes(value: unknown): QuoteCandidateAmountTradeMode[] {
  if (!Array.isArray(value)) return ["export_usd", "domestic_cny"];
  return value.filter(
    (item): item is QuoteCandidateAmountTradeMode =>
      item === "export_usd" || item === "domestic_cny" || item === "unknown"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!isFinanceQuoteCandidateAmountImportEnabled()) {
    return NextResponse.json({ error: "财务候选金额导入暂未开放" }, { status: 403 });
  }

  const { batchId } = await params;
  const body = await request.json().catch(() => ({}));
  const tradeModes = normalizeTradeModes((body as { tradeModes?: unknown }).tradeModes);

  try {
    const result = await importQuoteCandidateAmountsForBatch(user, {
      batchId,
      tradeModes
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "候选金额导入失败" },
      { status: 400 }
    );
  }
}
