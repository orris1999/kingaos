import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { listGeoCities } from "@/lib/honoa/server/geo";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const countryCode = request.nextUrl.searchParams.get("countryCode") || "";
  const stateCode = request.nextUrl.searchParams.get("stateCode") || "";
  const cities = await listGeoCities(countryCode, stateCode);
  return NextResponse.json(cities, {
    headers: {
      "Cache-Control": "private, max-age=1800"
    }
  });
}
