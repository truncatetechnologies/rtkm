import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load, toLoad } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { calcOil } from "@rtkm/shared";

// GET /api/loads?transportId=&driverId=&truckId=
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager", "driver"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();

  const filter = { transportId: scope.transportId };
  if (scope.identity.role === "driver") filter.driverId = scope.identity.userId; // drivers see own loads
  const driverId = searchParams.get("driverId");
  const truckId = searchParams.get("truckId");
  const company = searchParams.get("company");
  if (driverId) filter.driverId = driverId;
  if (truckId) filter.truckId = truckId;
  if (company && company !== "all") filter.company = company;

  const loads = await Load.find(filter).sort({ loadDate: -1 }).limit(500);
  return NextResponse.json({ loads: loads.map(toLoad) });
}

// POST /api/loads — manual load entry
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();

  const rtkm = Number(b.rtkm) || 0;
  const averageKmL = Number(b.averageKmL) || 4;
  const ratePerL = Number(b.ratePerL) || 0;
  const oilLiters = calcOil(rtkm, averageKmL) || 0;
  const loadQtyL = Number(b.loadQtyL) || 0;
  const deliveredQtyL = b.deliveredQtyL != null ? Number(b.deliveredQtyL) : loadQtyL;
  const shortageL = Math.max(0, loadQtyL - deliveredQtyL);

  const load = await Load.create({
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    truckId: b.truckId || null,
    driverId: b.driverId || null,
    company: String(b.company || ""),
    invoiceNumber: String(b.invoiceNumber || "").trim(),
    invoiceDate: b.invoiceDate ? new Date(b.invoiceDate) : null,
    fromLocation: String(b.fromLocation || ""),
    toLocation: String(b.toLocation || ""),
    pumpCode: String(b.pumpCode || ""),
    pumpId: b.pumpId || null,
    roName: String(b.roName || ""),
    cmsCode: String(b.cmsCode || ""),
    product: String(b.product || ""),
    loadQtyL, deliveredQtyL, shortageL,
    rtkm, averageKmL, oilLiters, ratePerL, oilCost: oilLiters * ratePerL,
    loadDate: b.loadDate ? new Date(b.loadDate) : new Date(),
    notes: String(b.notes || ""),
  });
  return NextResponse.json({ load: toLoad(load) }, { status: 201 });
}
