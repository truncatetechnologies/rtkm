import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Pump, toClient } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// GET /api/admin/submissions?status=pending — driver-submitted pumps awaiting moderation
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const docs = await Pump.find({ status, isDeleted: false }).sort({ createdAt: -1 }).limit(500);
  return NextResponse.json({ submissions: docs.map(toClient), count: docs.length });
}
