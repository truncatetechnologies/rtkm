import { NextResponse } from "next/server";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";

export function unauth(msg = "Unauthorized") {
  return NextResponse.json({ error: msg }, { status: 401 });
}
export function forbidden(msg = "Forbidden") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

// Resolve the caller + which transport they're acting on.
// owner: must pass a transportId they own. manager/driver: pinned to their transport.
// Returns { identity, transportId, ownerId } or a NextResponse error.
export async function resolveScope(request, { roles, transportId }) {
  const identity = await requireAuth(request, { roles });
  if (!identity) return { error: unauth() };

  if (identity.role === "owner") {
    if (!transportId) return { error: NextResponse.json({ error: "transportId required" }, { status: 400 }) };
    const ok = await canAccessTransport(identity, transportId);
    if (!ok) return { error: forbidden("Not your transport") };
    return { identity, transportId: String(transportId), ownerId: identity.userId };
  }

  // manager / driver
  if (!identity.transportId) return { error: forbidden("No transport assigned") };
  return { identity, transportId: identity.transportId, ownerId: identity.ownerId };
}
