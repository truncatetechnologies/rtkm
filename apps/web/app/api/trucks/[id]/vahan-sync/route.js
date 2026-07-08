import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Truck, toTruck } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";
import { syncTruckVahan } from "@/lib/services/vahanSync";

export const dynamic = "force-dynamic";

// POST /api/trucks/:id/vahan-sync — pull the vehicle's record from VAHAN/Parivahan.
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const truck = await Truck.findById(params.id);
  if (!truck) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTransport(me, truck.transportId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!truck.registrationNo) return NextResponse.json({ error: "Add a registration number first" }, { status: 400 });

  try {
    await syncTruckVahan(truck, { ownerId: truck.ownerId, transportId: truck.transportId });
    return NextResponse.json({ truck: toTruck(truck) });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e), truck: toTruck(truck) }, { status: 502 });
  }
}
