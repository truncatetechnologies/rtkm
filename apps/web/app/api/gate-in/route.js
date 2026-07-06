import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { gateInList } from "@/lib/services/gateIn";

// GET /api/gate-in?transportId=&vehicleNo=
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  return NextResponse.json(await gateInList({ scope, vehicleNo: searchParams.get("vehicleNo") || "" }));
}
