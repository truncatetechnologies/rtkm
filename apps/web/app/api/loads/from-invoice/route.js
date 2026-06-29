import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load, toLoad, Truck, Upload } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { calcOil } from "@rtkm/shared";
import { recomputeShipmentOil, shipmentSummaryForLoad } from "@/lib/services/ledger";

// Accepts "dd.mm.yyyy[ hh:mm:ss]", "dd/mm/yyyy", or ISO; returns a Date (UTC noon) or null.
function parseInvoiceDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// POST /api/loads/from-invoice — confirm a parsed invoice draft into a Load
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager", "driver"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();

  if (!b.invoiceNumber?.trim()) return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });

  // Match truck by registration if not provided; default driver from truck assignment.
  let truckId = b.truckId || null;
  let driverId = b.driverId || null;
  if (!truckId && b.truckReg) {
    const truck = await Truck.findOne({ transportId: scope.transportId, registrationNo: new RegExp(`^${String(b.truckReg).replace(/\s/g, "\\s*")}$`, "i") });
    if (truck) { truckId = truck._id; if (!driverId) driverId = truck.assignedDriverId; }
  }
  if (truckId && !driverId) {
    const truck = await Truck.findById(truckId);
    if (truck?.assignedDriverId) driverId = truck.assignedDriverId;
  }

  const rtkm = Number(b.rtkm) || 0;
  const averageKmL = Number(b.averageKmL) || 4;
  const ratePerL = Number(b.ratePerL) || 0;
  const oilLiters = calcOil(rtkm, averageKmL) || 0;
  const loadQtyL = Number(b.loadQtyL) || 0;
  const deliveredQtyL = b.deliveredQtyL != null ? Number(b.deliveredQtyL) : loadQtyL;

  const invoiceNumber = String(b.invoiceNumber).trim();
  const fields = {
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    truckId, driverId,
    company: String(b.company || ""),
    invoiceNumber,
    invoiceDate: parseInvoiceDate(b.invoiceDate),
    fromLocation: String(b.fromLocation || ""),
    toLocation: String(b.toLocation || ""),
    pumpCode: String(b.pumpCode || ""),
    cmsCode: String(b.pumpCode || ""),
    roName: String(b.roName || ""),
    product: String(b.product || ""),
    shipmentNo: String(b.shipmentNo || ""),
    lrNumber: String(b.lrNumber || ""),
    supplyLocation: String(b.supplyLocation || ""),
    notes: String(b.address || ""),
    loadQtyL, deliveredQtyL, shortageL: Math.max(0, loadQtyL - deliveredQtyL),
    rtkm, averageKmL, oilLiters, ratePerL, oilCost: oilLiters * ratePerL,
    loadDate: parseInvoiceDate(b.invoiceDate) || new Date(),
    sourcePdfId: b.uploadId || null,
  };
  // Upsert by invoice number so re-confirming the same invoice updates instead of duplicating.
  const existed = await Load.findOne({ transportId: scope.transportId, invoiceNumber }).select("_id");
  const load = await Load.findOneAndUpdate(
    { transportId: scope.transportId, invoiceNumber },
    { $set: fields },
    { upsert: true, new: true }
  );

  if (b.uploadId) await Upload.updateOne({ _id: b.uploadId }, { status: "linked" });
  await recomputeShipmentOil(scope); // club by shipment & set diesel given (max RTKM / avg)
  const fresh = await Load.findById(load._id);
  const shipment = await shipmentSummaryForLoad(scope, fresh || load); // total/longest RTKM + diesel for the trip
  return NextResponse.json({ load: toLoad(fresh || load), shipment, duplicate: !!existed }, { status: 201 });
}
