import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Shortage, toShortage } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// POST /api/shortages/:id/waive (owner) — cancel a shortage so it won't deduct salary
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner"] });
  if (!me) return unauth();
  await dbConnect();
  const s = await Shortage.findById(params.id);
  if (!s || !(await canAccessTransport(me, s.transportId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (s.status === "deducted") return NextResponse.json({ error: "Already applied to a payslip" }, { status: 400 });
  s.status = "waived";
  await s.save();
  return NextResponse.json({ shortage: toShortage(s) });
}
