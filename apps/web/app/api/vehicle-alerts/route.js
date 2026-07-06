import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { alertList } from "@/lib/services/vehicleAlert";

// GET /api/vehicle-alerts?transportId=
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  return NextResponse.json(await alertList({ scope }));
}
