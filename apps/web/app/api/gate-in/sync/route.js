import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { syncGateIns } from "@/lib/services/gateIn";

// POST /api/gate-in/sync { transportId, days? } — scan Gmail for depot Gate-In emails and store them.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  const r = await syncGateIns({ scope, days: b.days });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r);
}
