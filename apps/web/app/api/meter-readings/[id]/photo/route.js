import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { MeterReading } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth, forbidden } from "@/lib/api/scope";
import { readMeterPhoto } from "@/lib/services/meterReading";

// GET /api/meter-readings/[id]/photo — serve the meter photo to the driver who filed it
// or to an owner/manager who can access its transport.
export async function GET(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager", "driver"] });
  if (!me) return unauth();
  await dbConnect();

  const reading = await MeterReading.findById(params.id).select("driverId transportId photoPath");
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownsIt = me.role === "driver" && String(reading.driverId) === me.userId;
  const canReview = (me.role === "owner" || me.role === "manager") && (await canAccessTransport(me, String(reading.transportId)));
  if (!ownsIt && !canReview) return forbidden();

  const photo = await readMeterPhoto(reading);
  if (!photo) return NextResponse.json({ error: "No photo" }, { status: 404 });
  return new NextResponse(photo.buf, {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=3600" },
  });
}
