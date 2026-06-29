import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Pump, toClient } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// POST /api/admin/submissions/:id  { action: "approve" | "reject", reason? }
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const { action, reason } = await request.json();

  const pump = await Pump.findById(params.id);
  if (!pump || pump.status !== "pending") {
    return NextResponse.json({ error: "Not a pending submission" }, { status: 404 });
  }

  if (action === "approve") {
    pump.status = "approved";
    pump.approvedBy = me.email || "admin";
    pump.approvedAt = new Date();
    pump.rejectionReason = "";
  } else if (action === "reject") {
    pump.status = "rejected";
    pump.rejectionReason = String(reason || "");
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  await pump.save();
  return NextResponse.json({ pump: toClient(pump) });
}
