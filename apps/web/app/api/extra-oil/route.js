import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { ExtraOil, toExtraOil, Truck, User, Load } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/extra-oil?transportId= — list extra-diesel entries (newest first).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const items = await ExtraOil.find({ transportId: scope.transportId }).sort({ date: -1 }).limit(500);
  return NextResponse.json({ extraOil: items.map(toExtraOil) });
}

// POST /api/extra-oil — log extra diesel given mid-trip (owner/manager).
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();

  const litres = Number(b.litres) || 0;
  if (!(litres > 0)) return NextResponse.json({ error: "Litres must be greater than 0" }, { status: 400 });

  let truckId = b.truckId || null, driverId = b.driverId || null;
  let vehicleNo = String(b.vehicleNo || "").trim().toUpperCase();
  let driverName = String(b.driverName || "").trim();
  let shipmentNo = String(b.shipmentNo || "").trim();
  let invoiceNumber = String(b.invoiceNumber || "").trim();
  let loadId = b.loadId || null;

  // Logged against a delivery → inherit shipment / invoice / truck / driver from that load.
  if (loadId) {
    const load = await Load.findOne({ _id: loadId, transportId: scope.transportId });
    if (!load) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    truckId = load.truckId || truckId;
    driverId = load.driverId || driverId;
    vehicleNo = vehicleNo || load.vehicleNo || "";
    shipmentNo = shipmentNo || load.shipmentNo || "";
    invoiceNumber = invoiceNumber || load.invoiceNumber || "";
  }

  // Denormalise vehicle reg + driver name so the log + report read on their own.
  if (truckId) {
    const truck = await Truck.findOne({ _id: truckId, transportId: scope.transportId });
    if (truck && !vehicleNo) vehicleNo = truck.registrationNo || "";
  }
  if (driverId) {
    const driver = await User.findOne({ _id: driverId, transportId: scope.transportId });
    if (driver) driverName = driver.name || driverName;
  }

  const ratePerL = Number(b.ratePerL) || 0;
  const item = await ExtraOil.create({
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    truckId, vehicleNo, driverId, driverName,
    loadId, invoiceNumber, shipmentNo,
    litres,
    reason: String(b.reason || "other"),
    notes: String(b.notes || "").trim(),
    ratePerL,
    cost: Math.round(litres * ratePerL * 100) / 100,
    date: b.date ? new Date(b.date) : new Date(),
    createdBy: scope.identity?.userId || null,
  });
  return NextResponse.json({ extraOil: toExtraOil(item) }, { status: 201 });
}
