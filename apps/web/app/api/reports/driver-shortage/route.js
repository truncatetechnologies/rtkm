import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { Shortage, User } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/reports/driver-shortage?transportId=&period=YYYY-MM
// Which driver caused how much shortage (litres + ₹) per month.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();

  const match = { transportId: new mongoose.Types.ObjectId(scope.transportId) };
  if (/^\d{4}-\d{2}$/.test(period || "")) {
    const [y, m] = period.split("-").map(Number);
    match.reportedAt = { $gte: new Date(Date.UTC(y, m - 1, 1)), $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)) };
  }

  const grouped = await Shortage.aggregate([
    { $match: match },
    { $group: {
      _id: { driverId: "$driverId", month: { $dateToString: { format: "%Y-%m", date: "$reportedAt" } } },
      shortageL: { $sum: "$shortageL" }, shortageValue: { $sum: "$shortageValue" }, trips: { $sum: 1 },
    } },
    { $sort: { "_id.month": -1, shortageValue: -1 } },
  ]);

  // distinct months for the filter
  const monthsAgg = await Shortage.aggregate([
    { $match: { transportId: match.transportId } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$reportedAt" } } } },
    { $sort: { _id: -1 } },
  ]);

  const driverIds = [...new Set(grouped.map((g) => g._id.driverId).filter(Boolean).map(String))];
  const drivers = await User.find({ _id: { $in: driverIds } }).select("name");
  const nameOf = Object.fromEntries(drivers.map((d) => [String(d._id), d.name]));

  const rows = grouped.map((g) => ({
    driverId: g._id.driverId ? String(g._id.driverId) : null,
    driverName: g._id.driverId ? (nameOf[String(g._id.driverId)] || "Driver") : "Unassigned",
    period: g._id.month,
    shortageL: Math.round(g.shortageL * 100) / 100,
    shortageValue: Math.round(g.shortageValue * 100) / 100,
    trips: g.trips,
  }));

  const totals = rows.reduce((a, r) => ({ shortageL: a.shortageL + r.shortageL, shortageValue: a.shortageValue + r.shortageValue, trips: a.trips + r.trips }), { shortageL: 0, shortageValue: 0, trips: 0 });

  return NextResponse.json({ rows, totals, months: monthsAgg.map((m) => m._id), period: period || "" });
}
