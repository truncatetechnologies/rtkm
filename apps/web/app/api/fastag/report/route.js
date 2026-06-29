import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { fastagReport } from "@/lib/services/fastag";

// GET /api/fastag/report?transportId=&period=YYYY-MM
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  return NextResponse.json(await fastagReport({ scope, period: searchParams.get("period") || "" }));
}
