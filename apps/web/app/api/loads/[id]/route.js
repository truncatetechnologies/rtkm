import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load, toLoad } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";
import { calcOil } from "@rtkm/shared";
import { recomputeShipmentOil } from "@/lib/services/ledger";

async function loadFor(id, me) {
  const ld = await Load.findById(id);
  if (!ld) return null;
  const ok = await canAccessTransport(me, ld.transportId);
  return ok ? ld : null;
}

export async function PUT(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const ld = await loadFor(params.id, me);
  if (!ld) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await request.json();
  const fields = ["truckId", "driverId", "company", "invoiceNumber", "fromLocation", "toLocation",
    "pumpCode", "product", "notes", "status"];
  fields.forEach((k) => { if (b[k] !== undefined) ld[k] = b[k]; });
  if (b.rtkm != null) ld.rtkm = Number(b.rtkm) || 0;
  if (b.averageKmL != null) ld.averageKmL = Number(b.averageKmL) || 4;
  if (b.ratePerL != null) ld.ratePerL = Number(b.ratePerL) || 0;
  if (b.loadQtyL != null) ld.loadQtyL = Number(b.loadQtyL) || 0;
  if (b.deliveredQtyL != null) ld.deliveredQtyL = Number(b.deliveredQtyL) || 0;
  ld.shortageL = Math.max(0, (ld.loadQtyL || 0) - (ld.deliveredQtyL || 0));
  ld.oilLiters = calcOil(ld.rtkm, ld.averageKmL) || 0;
  ld.oilCost = ld.oilLiters * (ld.ratePerL || 0);
  await ld.save();
  // Editing rtkm can change the shipment's farthest pump → re-club the oil across the shipment.
  await recomputeShipmentOil({ transportId: String(ld.transportId), ownerId: String(ld.ownerId) });
  const fresh = await Load.findById(ld._id);
  return NextResponse.json({ load: toLoad(fresh || ld) });
}

export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const ld = await loadFor(params.id, me);
  if (!ld) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tScope = { transportId: String(ld.transportId), ownerId: String(ld.ownerId) };
  await ld.deleteOne();
  await recomputeShipmentOil(tScope); // deleting a pump may change its shipment's max RTKM
  return NextResponse.json({ ok: true });
}
