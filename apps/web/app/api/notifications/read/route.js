import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Notification } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// POST /api/notifications/read { transportId, ids? } — mark some (or all) notifications read.
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();
  const filter = { transportId: scope.transportId, read: false };
  if (Array.isArray(b.ids) && b.ids.length) filter._id = { $in: b.ids };
  const r = await Notification.updateMany(filter, { $set: { read: true } });
  return NextResponse.json({ ok: true, updated: r.modifiedCount || 0 });
}
