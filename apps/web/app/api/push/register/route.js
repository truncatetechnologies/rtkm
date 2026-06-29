import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { PushSubscription } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { requireAuth } from "@/lib/auth/session";

// POST /api/push/register
//   { transportId, platform:"expo", token }                  — mobile device (owner/manager)
//   { transportId, platform:"web",  subscription:{endpoint…} } — browser
//   { platform:"expo", token }  (no transportId)             — admin device (not tied to a transport)
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  await dbConnect();

  let base;
  if (!b.transportId) {
    const me = await requireAuth(request, { roles: ["admin"] });
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    base = { ownerId: me.userId, transportId: null, userId: me.userId };
  } else {
    const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
    if (scope.error) return scope.error;
    base = { ownerId: scope.ownerId, transportId: scope.transportId, userId: scope.identity?.userId || null };
  }
  if (b.platform === "expo" && b.token) {
    await PushSubscription.findOneAndUpdate(
      { platform: "expo", token: b.token },
      { $set: { ...base, platform: "expo", token: b.token } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  }
  if (b.platform === "web" && b.subscription?.endpoint) {
    await PushSubscription.findOneAndUpdate(
      { platform: "web", endpoint: b.subscription.endpoint },
      { $set: { ...base, platform: "web", endpoint: b.subscription.endpoint, subscription: b.subscription } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Missing token or subscription" }, { status: 400 });
}
