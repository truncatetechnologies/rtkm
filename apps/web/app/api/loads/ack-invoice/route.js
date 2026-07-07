import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// POST /api/loads/ack-invoice { transportId, invoiceNumber, ack? }
// Mark a delivery's Tax Invoice as "received offline / acknowledged" (ack=true, default) or undo
// (ack=false), so it stops counting as a pending/missing invoice. Doesn't set hasInvoice — the
// delivery still has no PDF; it's just acknowledged so the count and notifications drop.
export async function POST(request) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const b = await request.json().catch(() => ({}));
  if (!b.transportId || !b.invoiceNumber) return NextResponse.json({ error: "transportId & invoiceNumber required" }, { status: 400 });
  if (!(await canAccessTransport(me, b.transportId))) return unauth();

  const ack = b.ack !== false; // default true
  const r = await Load.updateMany(
    { transportId: b.transportId, invoiceNumber: String(b.invoiceNumber), hasInvoice: false },
    { $set: { invoiceAck: ack } }
  );
  return NextResponse.json({ ok: true, invoiceNumber: b.invoiceNumber, ack, updated: r.modifiedCount || 0 });
}
