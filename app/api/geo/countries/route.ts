import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/honoa/server/auth";
import { listGeoCountries } from "@/lib/honoa/server/geo";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const countries = await listGeoCountries();
  return NextResponse.json(countries, {
    headers: {
      "Cache-Control": "private, max-age=3600"
    }
  });
}
