import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Truck, toTruck, User } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

async function loadTruck(id, me) {
  const truck = await Truck.findById(id);
  if (!truck) return null;
  const ok = await canAccessTransport(me, truck.transportId);
  return ok ? truck : null;
}

export async function PUT(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const truck = await loadTruck(params.id, me);
  if (!truck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await request.json();
  if (b.type) truck.type = b.type === "truck" ? "truck" : "tanker";
  ["name", "registrationNo"].forEach((k) => { if (b[k] != null) truck[k] = String(b[k]).trim(); });
  if (b.capacity != null) truck.capacity = Number(b.capacity) || 0;
  if (b.averageKmL != null) truck.averageKmL = Number(b.averageKmL) || 4;
  if (b.active != null) truck.active = !!b.active;

  if (b.assignedDriverId !== undefined) {
    const newDriver = b.assignedDriverId || null;
    truck.assignedDriverId = newDriver;
    // Keep the driver's assignedTruckId in sync.
    if (newDriver) await User.updateOne({ _id: newDriver }, { assignedTruckId: truck._id });
  }
  await truck.save();
  return NextResponse.json({ truck: toTruck(truck) });
}

export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const truck = await loadTruck(params.id, me);
  if (!truck) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await truck.deleteOne();
  return NextResponse.json({ ok: true });
}
