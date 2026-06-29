import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Transport, toTransport } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";
import { recomputeShipmentOil } from "@/lib/services/ledger";

export async function PUT(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner"] });
  if (!me) return unauth();
  await dbConnect();
  const b = await request.json();
  const update = {};
  ["name", "address", "gstNo", "phone"].forEach((k) => { if (b[k] != null) update[k] = String(b[k]).trim(); });
  if (b.active != null) update.active = !!b.active;
  if (b.tankerAvg != null && Number(b.tankerAvg) > 0) update.tankerAvg = Number(b.tankerAvg);
  if (b.dieselPrice != null && Number(b.dieselPrice) >= 0) update.dieselPrice = Number(b.dieselPrice);
  if (b.mealAllowancePerTrip != null && Number(b.mealAllowancePerTrip) >= 0) update.mealAllowancePerTrip = Number(b.mealAllowancePerTrip);
  const tr = await Transport.findOneAndUpdate({ _id: params.id, ownerId: me.userId }, update, { new: true });
  if (!tr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Changing the tanker average, diesel price or meal allowance changes every shipment's cost —
  // recompute so the ledger & reports stay correct (new values stamped on each load).
  if (update.tankerAvg != null || update.dieselPrice != null || update.mealAllowancePerTrip != null) await recomputeShipmentOil({ transportId: String(tr._id), ownerId: String(me.userId) });
  return NextResponse.json({ transport: toTransport(tr) });
}

export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner"] });
  if (!me) return unauth();
  await dbConnect();
  const r = await Transport.deleteOne({ _id: params.id, ownerId: me.userId });
  if (!r.deletedCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
