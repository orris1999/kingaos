import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { listGeoStates } from "@/lib/honoa/server/geo";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const countryCode = request.nextUrl.searchParams.get("countryCode") || "";
  const states = await listGeoStates(countryCode);
  return NextResponse.json(states, {
    headers: {
      "Cache-Control": "private, max-age=1800"
    }
  });
}
