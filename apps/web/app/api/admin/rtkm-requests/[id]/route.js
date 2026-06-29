import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { RtkmRequest, Pump } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// POST /api/admin/rtkm-requests/:id { action: "approve" | "reject" }
// Approve → write proposedRtkm into the master Pump. Reject → just close the request.
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  await dbConnect();
  const { action } = await request.json().catch(() => ({}));
  const req = await RtkmRequest.findById(params.id);
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.status !== "pending") return NextResponse.json({ error: "Already decided" }, { status: 400 });

  if (action === "approve") {
    if (req.pumpId) await Pump.updateOne({ _id: req.pumpId }, { $set: { rtkm: req.proposedRtkm } });
    req.status = "approved";
  } else {
    req.status = "rejected";
  }
  req.decidedBy = me.name || "admin";
  req.decidedAt = new Date();
  await req.save();
  return NextResponse.json({ ok: true, status: req.status });
}
