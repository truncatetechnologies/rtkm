import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { MeterReading, toMeterReading } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { createMeterReading } from "@/lib/services/meterReading";

// GET /api/meter-readings?transportId=&driverId= — owner/manager review of driver meter readings
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();

  const filter = { transportId: scope.transportId };
  const driverId = searchParams.get("driverId");
  if (driverId) filter.driverId = driverId;

  const readings = await MeterReading.find(filter).sort({ recordedAt: -1 }).limit(300);
  return NextResponse.json({ readings: readings.map(toMeterReading) });
}

// POST /api/meter-readings — transporter (owner/manager) enters a reading manually for a trip.
// multipart/form-data: transportId, loadId, readingKm, notes, driverId?, photo(file)
export async function POST(request) {
  const form = await request.formData();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: form.get("transportId") });
  if (scope.error) return scope.error;

  const loadId = form.get("loadId");
  if (!loadId) return NextResponse.json({ error: "Pick a trip" }, { status: 400 });

  const r = await createMeterReading({
    scope,
    loadId,
    readingKm: form.get("readingKm"),
    notes: form.get("notes"),
    source: "transporter",
    file: form.get("photo"),
    driverId: form.get("driverId") || null,
  });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 404 });
  return NextResponse.json({ reading: toMeterReading(r.reading) }, { status: 201 });
}
