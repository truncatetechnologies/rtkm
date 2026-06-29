import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Leave, toLeave, User } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// Parse "YYYY-MM-DD" (or ISO) to a Date anchored at UTC noon, so whole-day math is timezone-safe.
function parseDay(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/leaves?transportId=&driverId= — driver leave log (optionally for one driver)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();

  const filter = { transportId: scope.transportId };
  const driverId = searchParams.get("driverId");
  if (driverId) filter.driverId = driverId;
  const leaves = await Leave.find(filter).sort({ fromDate: -1 }).limit(500);
  return NextResponse.json({ leaves: leaves.map(toLeave) });
}

// POST /api/leaves — record a leave (single day or range) for a driver
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();

  if (!b.driverId) return NextResponse.json({ error: "Driver is required" }, { status: 400 });
  const driver = await User.findOne({ _id: b.driverId, role: "driver", transportId: scope.transportId }).select("_id");
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const fromDate = parseDay(b.fromDate);
  if (!fromDate) return NextResponse.json({ error: "A valid from-date is required" }, { status: 400 });
  const toDate = parseDay(b.toDate) || fromDate;
  if (toDate < fromDate) return NextResponse.json({ error: "End date can't be before start date" }, { status: 400 });

  const leave = await Leave.create({
    ownerId: scope.ownerId, transportId: scope.transportId, driverId: b.driverId,
    fromDate, toDate, paid: !!b.paid, reason: String(b.reason || "").trim(),
  });
  return NextResponse.json({ leave: toLeave(leave) }, { status: 201 });
}
