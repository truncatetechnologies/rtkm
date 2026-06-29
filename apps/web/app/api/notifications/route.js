import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Notification, toNotification } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/notifications?transportId= — recent notifications + unread count for the bell.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const [items, unread] = await Promise.all([
    Notification.find({ transportId: scope.transportId }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ transportId: scope.transportId, read: false }),
  ]);
  return NextResponse.json({ notifications: items.map(toNotification), unread });
}
