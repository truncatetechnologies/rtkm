import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/companies?transportId= — distinct oil companies this transport has loads for
// (nayara / hpcl / bpcl / ioc). Drives the top-level company/depot selector.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const companies = (await Load.distinct("company", { transportId: scope.transportId })).filter(Boolean).sort();
  return NextResponse.json({ companies });
}
