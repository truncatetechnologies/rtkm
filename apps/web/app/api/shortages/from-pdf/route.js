import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load, Shortage, toShortage, User, Upload } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// POST /api/shortages/from-pdf — confirm a parsed shortage draft; maps to a load by invoice number,
// records the shortage and computes the salary deduction (shortageL × driver's rate).
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager", "driver"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();

  const invoiceNumber = String(b.invoiceNumber || "").trim();
  const shortageL = Number(b.shortageL) || 0;
  if (!invoiceNumber) return NextResponse.json({ error: "Invoice number is required to map the shortage" }, { status: 400 });
  if (shortageL <= 0) return NextResponse.json({ error: "Shortage quantity must be greater than 0" }, { status: 400 });

  // Map to the load by invoice number within this transport.
  const load = await Load.findOne({ transportId: scope.transportId, invoiceNumber });
  if (!load) {
    return NextResponse.json({ error: `No load found for invoice ${invoiceNumber}. Add/confirm the invoice first.` }, { status: 404 });
  }

  const driver = load.driverId ? await User.findById(load.driverId) : null;
  const ratePerUnit = driver?.shortageRatePerUnit || 0;
  const shortageValue = shortageL * ratePerUnit;

  const shortage = await Shortage.create({
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    loadId: load._id,
    driverId: load.driverId || null,
    invoiceNumber,
    shortageL,
    ratePerUnit,
    shortageValue,
    status: "open",
    sourcePdfId: b.uploadId || null,
    notes: b.notes || "",
  });

  // Reflect the shortage back on the load.
  load.shortageL = shortageL;
  load.deliveredQtyL = Math.max(0, (load.loadQtyL || 0) - shortageL);
  await load.save();
  if (b.uploadId) await Upload.updateOne({ _id: b.uploadId }, { status: "linked" });

  return NextResponse.json({
    shortage: toShortage(shortage),
    mappedTo: { loadId: String(load._id), driverId: load.driverId ? String(load.driverId) : null, deduction: shortageValue },
  }, { status: 201 });
}
