import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load, toLoad, Truck, User } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { fastagPerShipment } from "@/lib/services/fastag";

// GET /api/ledger?transportId=&status= — freight loads + settlement summary.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();

  // Optional company/depot filter (nayara / hpcl / bpcl / ioc). "all" or empty = every company.
  const company = searchParams.get("company");
  const companyFilter = company && company !== "all" ? { company } : {};

  // Optional date range (by delivery/load date) — the dashboard passes the selected period so the
  // settlement/collection cards follow the same filter as the spend tiles. The ledger page omits it.
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dateFilter = {};
  if (from || to) {
    dateFilter.loadDate = {};
    if (from) dateFilter.loadDate.$gte = new Date(from);
    if (to) dateFilter.loadDate.$lte = new Date(to);
  }

  const filter = { transportId: scope.transportId, ...companyFilter, ...dateFilter };
  const status = searchParams.get("status");
  if (status === "pending" || status === "settled") filter.settlementStatus = status;

  const loads = await Load.find(filter).sort({ loadDate: -1 }).limit(2000);

  // Resolve driver name + truck registration so the ledger shows who drove which tanker.
  // Resolution is done at READ time and matches the tanker by registration too — so once you
  // register a tanker + assign a driver, every past delivery on that tanker shows the driver
  // (no re-upload needed). Falls back to the driver name read from the invoice PDF.
  const [trucks, drivers] = await Promise.all([
    Truck.find({ transportId: scope.transportId }).select("registrationNo name assignedDriverId"),
    User.find({ transportId: scope.transportId, role: "driver" }).select("name"),
  ]);
  const driverById = new Map(drivers.map((d) => [String(d._id), d.name || ""]));
  const norm = (r) => String(r || "").replace(/\s/g, "").toUpperCase();
  const truckById = new Map(trucks.map((t) => [String(t._id), t]));
  const truckByReg = new Map(trucks.filter((t) => t.registrationNo).map((t) => [norm(t.registrationNo), t]));
  const enrich = (l) => {
    const o = toLoad(l);
    const truck = (l.truckId && truckById.get(String(l.truckId))) || truckByReg.get(norm(l.vehicleNo)) || null;
    o.truckReg = truck?.registrationNo || l.vehicleNo || "";
    o.driverName =
      (l.driverId && driverById.get(String(l.driverId))) ||
      (truck?.assignedDriverId && driverById.get(String(truck.assignedDriverId))) ||
      l.driverName || "";
    return o;
  };

  const all = await Load.find({ transportId: scope.transportId, ...companyFilter, ...dateFilter });
  const sum = (f) => all.reduce((s, l) => s + (l[f] || 0), 0);
  const pendingFreight = all.filter((l) => l.settlementStatus !== "settled").reduce((s, l) => s + (l.freightAmount || 0), 0);
  const summary = {
    totalFreight: sum("freightAmount"),
    totalReceived: sum("netReceived"),
    totalTds: sum("tdsAmount"),
    totalDeduction: sum("nayaraShortageDeduction"),
    pendingFreight,
    totalOil: sum("oilLiters"), // diesel given to drivers (lead-load only → no double-count per shipment)
    shipments: new Set(all.map((l) => l.shipmentNo || `i:${l._id}`)).size,
    pendingInvoice: all.filter((l) => !l.hasInvoice && !l.invoiceAck).length, // Tax Invoice not uploaded AND not acknowledged
    loads: all.length,
    settled: all.filter((l) => l.settlementStatus === "settled").length,
    pending: all.filter((l) => l.settlementStatus !== "settled").length,
  };

  // Per-trip FASTag tolls, attributed by date + tanker (no direct load↔toll link exists).
  const fastagByShipment = await fastagPerShipment(scope.transportId, all);

  return NextResponse.json({ loads: loads.map(enrich), summary, fastagByShipment });
}
