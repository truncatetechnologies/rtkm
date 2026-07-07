import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { syncDeliveryConfirmations } from "@/lib/services/deliveryConfirmation";

// POST /api/deliveries/sync { transportId, days? } — scan Gmail for Nayara delivery-confirmation
// emails and record shortages early (before the monthly freight PDF).
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  const r = await syncDeliveryConfirmations({ scope, days: b.days });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r);
}
