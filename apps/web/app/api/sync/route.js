import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Pump, toClient } from "@/lib/models";

// GET /api/sync?since=<ISO timestamp>
// Returns all pumps changed since `since` (including soft-deleted ones),
// so the mobile app can incrementally update its local cache.
export async function GET(request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const sinceRaw = searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : new Date(0);

  // Only approved pumps (to add/update) and deletions (to remove) reach mobile clients.
  const visibility = { $or: [{ status: "approved" }, { isDeleted: true }] };
  const filter = isNaN(since.getTime())
    ? visibility
    : { ...visibility, updatedAt: { $gt: since } };
  const docs = await Pump.find(filter).sort({ updatedAt: 1 }).limit(5000);

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    count: docs.length,
    pumps: docs.map(toClient), // each includes isDeleted + updatedAt
  });
}
