import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Truck, toTruck } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/trucks?transportId= — trucks in a transport
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager", "driver"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const trucks = await Truck.find({ transportId: scope.transportId }).sort({ createdAt: -1 });
  return NextResponse.json({ trucks: trucks.map(toTruck) });
}

// POST /api/trucks
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();
  if (!b.name && !b.registrationNo) return NextResponse.json({ error: "Add a name or registration number" }, { status: 400 });
  const truck = await Truck.create({
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    type: b.type === "truck" ? "truck" : "tanker",
    name: String(b.name || "").trim(),
    registrationNo: String(b.registrationNo || "").trim(),
    capacity: Number(b.capacity) || 0,
    averageKmL: Number(b.averageKmL) || 4,
    assignedDriverId: b.assignedDriverId || null,
  });
  return NextResponse.json({ truck: toTruck(truck) }, { status: 201 });
}
