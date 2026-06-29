import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Notification, toNotification } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// GET /api/admin/notifications — the admin's own notifications (approvals etc.) + unread count.
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const [items, unread] = await Promise.all([
    Notification.find({ ownerId: me.userId }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ ownerId: me.userId, read: false }),
  ]);
  return NextResponse.json({ notifications: items.map(toNotification), unread });
}

// POST /api/admin/notifications  { ids?: [] }  — mark given (or all) as read.
export async function POST(request) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const { ids } = await request.json().catch(() => ({}));
  const filter = { ownerId: me.userId, read: false };
  if (Array.isArray(ids) && ids.length) filter._id = { $in: ids };
  await Notification.updateMany(filter, { $set: { read: true } });
  return NextResponse.json({ ok: true });
}
