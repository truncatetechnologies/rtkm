import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { FastagWalletTxn } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// POST /api/fastag/charge/:id { status: "pending"|"expected"|"disputed", note? }
// Mark a non-toll charge as expected (accepted) or disputed (raise with BlackBuck).
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const c = await FastagWalletTxn.findById(params.id);
  if (!c || !(await canAccessTransport(me, c.transportId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const status = ["pending", "expected", "disputed"].includes(b.status) ? b.status : "pending";
  c.reviewStatus = status;
  c.reviewNote = String(b.note || "").slice(0, 300);
  c.reviewedAt = status === "pending" ? null : new Date();
  await c.save();
  return NextResponse.json({ ok: true });
}
