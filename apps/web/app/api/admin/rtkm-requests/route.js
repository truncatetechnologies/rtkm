import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { RtkmRequest, toRtkmRequest } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// GET /api/admin/rtkm-requests?status=pending — RTKM change requests for admin review.
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const filter = status === "all" ? {} : { status };
  const items = await RtkmRequest.find(filter).sort({ createdAt: -1 }).limit(200);
  const pending = await RtkmRequest.countDocuments({ status: "pending" });
  return NextResponse.json({ requests: items.map(toRtkmRequest), pending });
}
