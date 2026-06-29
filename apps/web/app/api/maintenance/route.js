import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Maintenance, toMaintenance } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const filter = { transportId: scope.transportId };
  if (searchParams.get("truckId")) filter.truckId = searchParams.get("truckId");
  const items = await Maintenance.find(filter).sort({ date: -1 }).limit(500);
  return NextResponse.json({ maintenance: items.map(toMaintenance) });
}

export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();
  const m = await Maintenance.create({
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    truckId: b.truckId || null,
    date: b.date ? new Date(b.date) : new Date(),
    category: String(b.category || "").trim(),
    description: String(b.description || "").trim(),
    cost: Number(b.cost) || 0,
    vendor: String(b.vendor || "").trim(),
    odometer: Number(b.odometer) || 0,
  });
  return NextResponse.json({ maintenance: toMaintenance(m) }, { status: 201 });
}
