import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { Transport, User, Truck, Load, SalaryRecord, MeterReading } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// GET /api/admin/transports/:id?period=YYYY-MM — one transporter's detail for a month. View-only (admin):
//   trucks/tankers, km run per tanker, loads per tanker, salary given per driver.
export async function GET(request, { params }) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();

  const t = await Transport.findById(params.id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tid = new mongoose.Types.ObjectId(params.id);

  // Months that have loads — for the period picker.
  const monthAgg = await Load.aggregate([
    { $match: { transportId: tid } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$loadDate", timezone: "UTC" } } } },
    { $sort: { _id: -1 } },
  ]);
  const months = monthAgg.map((m) => m._id).filter(Boolean);
  const reqPeriod = request.nextUrl.searchParams.get("period") || "";
  const now = new Date();
  const period = /^\d{4}-\d{2}$/.test(reqPeriod)
    ? reqPeriod
    : (months[0] || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`);

  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const owner = await User.findById(t.ownerId).select("name phone");
  const trucks = await Truck.find({ transportId: tid }).sort({ type: 1, registrationNo: 1 });
  const drivers = await User.find({ transportId: tid, role: "driver" }).select("name phone baseSalary assignedTruckId");

  // Loads in the period grouped by truck — count + trip km (RTKM sum) + cargo.
  const loadAgg = await Load.aggregate([
    { $match: { transportId: tid, loadDate: { $gte: start, $lte: end } } },
    { $group: { _id: "$truckId", loads: { $sum: 1 }, tripKm: { $sum: { $ifNull: ["$rtkm", 0] } }, cargo: { $sum: { $ifNull: ["$loadQtyL", 0] } } } },
  ]);
  const loadByTruck = new Map(loadAgg.map((r) => [String(r._id), r]));

  // Metered km per truck this period = max(odometer) − min(odometer) from meter readings.
  const meterAgg = await MeterReading.aggregate([
    { $match: { transportId: tid, recordedAt: { $gte: start, $lte: end }, readingKm: { $gt: 0 } } },
    { $group: { _id: "$truckId", lo: { $min: "$readingKm" }, hi: { $max: "$readingKm" }, n: { $sum: 1 } } },
  ]);
  const meterByTruck = new Map(meterAgg.map((r) => [String(r._id), r]));

  // Loads + salary by driver this period.
  const loadByDriverAgg = await Load.aggregate([
    { $match: { transportId: tid, loadDate: { $gte: start, $lte: end } } },
    { $group: { _id: "$driverId", loads: { $sum: 1 } } },
  ]);
  const loadByDriver = new Map(loadByDriverAgg.map((r) => [String(r._id), r.loads]));
  const slips = await SalaryRecord.find({ transportId: tid, period });
  const slipByDriver = new Map(slips.map((s) => [String(s.driverId), s]));

  const tankerRows = trucks.map((tr) => {
    const l = loadByTruck.get(String(tr._id));
    const mt = meterByTruck.get(String(tr._id));
    return {
      id: String(tr._id), registrationNo: tr.registrationNo || tr.name || "—", type: tr.type || "tanker",
      capacity: tr.capacity || 0,
      loads: l?.loads || 0, tripKm: Math.round(l?.tripKm || 0), cargo: Math.round(l?.cargo || 0),
      meteredKm: mt && mt.n > 1 ? Math.max(0, mt.hi - mt.lo) : 0, meterReadings: mt?.n || 0,
    };
  });

  const driverRows = drivers.map((d) => {
    const s = slipByDriver.get(String(d._id));
    return {
      id: String(d._id), name: d.name || "—", phone: d.phone || "",
      monthlySalary: d.baseSalary || 0,
      loads: loadByDriver.get(String(d._id)) || 0,
      salaryPaid: s ? s.netPay : null, salaryStatus: s ? s.status : "none",
    };
  });

  const totals = {
    trucks: trucks.length,
    tankers: trucks.filter((x) => x.type === "tanker").length,
    drivers: drivers.length,
    loads: tankerRows.reduce((a, r) => a + r.loads, 0),
    tripKm: tankerRows.reduce((a, r) => a + r.tripKm, 0),
    meteredKm: tankerRows.reduce((a, r) => a + r.meteredKm, 0),
    salaryPaid: driverRows.reduce((a, r) => a + (r.salaryPaid || 0), 0),
  };

  return NextResponse.json({
    transport: { id: String(t._id), name: t.name || "—", address: t.address || "", active: t.active !== false, ownerName: owner?.name || "—", ownerPhone: owner?.phone || "" },
    period, months, tankers: tankerRows, drivers: driverRows, totals,
  });
}
