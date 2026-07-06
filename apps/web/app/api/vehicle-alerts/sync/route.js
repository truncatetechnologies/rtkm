import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { syncDocExpiry } from "@/lib/services/vehicleAlert";

// POST /api/vehicle-alerts/sync { transportId, days? } — scan Gmail for document-expiry emails.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  const r = await syncDocExpiry({ scope, days: b.days });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r);
}
