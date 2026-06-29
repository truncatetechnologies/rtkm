import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";
import { recomputeShipmentOil } from "@/lib/services/ledger";

// POST /api/loads/:id/meal-allowance { amount }
// Override the meal allowance for this load's TRIP (shipment). Pins a manual value on the load;
// recompute then carries it on the trip's lead load (0 on other drops). Pass amount<0 to clear
// the override (back to the transport default).
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const ld = await Load.findById(params.id);
  if (!ld || !(await canAccessTransport(me, ld.transportId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { amount } = await request.json().catch(() => ({}));
  const clear = amount == null || Number(amount) < 0;

  // Clear any existing manual flag across the shipment, then pin this load (recompute moves it to lead).
  const filter = ld.shipmentNo
    ? { transportId: ld.transportId, shipmentNo: ld.shipmentNo }
    : { _id: ld._id };
  await Load.updateMany(filter, { $set: { mealAllowanceManual: false } });
  if (!clear) {
    ld.mealAllowance = Math.round(Number(amount) || 0);
    ld.mealAllowanceManual = true;
    await ld.save();
  }
  await recomputeShipmentOil({ transportId: String(ld.transportId), ownerId: String(ld.ownerId) });
  return NextResponse.json({ ok: true });
}
