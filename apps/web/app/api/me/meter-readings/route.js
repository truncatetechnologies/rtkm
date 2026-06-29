import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { MeterReading, toMeterReading } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { unauth, resolveScope } from "@/lib/api/scope";
import { createMeterReading } from "@/lib/services/meterReading";

// GET /api/me/meter-readings — a driver's own meter readings
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["driver"] });
  if (!me) return unauth();
  await dbConnect();
  const readings = await MeterReading.find({ driverId: me.userId }).sort({ recordedAt: -1 }).limit(200);
  return NextResponse.json({ readings: readings.map(toMeterReading) });
}

// POST /api/me/meter-readings — driver submits a reading (count + optional photo) for one of their trips.
// multipart/form-data: loadId, readingKm, notes, photo(file)
export async function POST(request) {
  const scope = await resolveScope(request, { roles: ["driver"], transportId: null });
  if (scope.error) return scope.error;

  const form = await request.formData();
  const loadId = form.get("loadId");
  if (!loadId) return NextResponse.json({ error: "Pick a trip" }, { status: 400 });

  const r = await createMeterReading({
    scope,
    loadId,
    readingKm: form.get("readingKm"),
    notes: form.get("notes"),
    source: "driver",
    file: form.get("photo"),
    driverId: scope.identity.userId, // a driver can only file their own reading
  });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 404 });
  return NextResponse.json({ reading: toMeterReading(r.reading) }, { status: 201 });
}
