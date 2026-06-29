import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { ExtraOil } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/reports/extra-oil?transportId=&period=YYYY-MM
// Rolls up extra diesel by driver and by truck so an owner can see who asks for extra,
// how many times and how much — and act on the worst offenders.
const ym = (d) => {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const period = searchParams.get("period") || "";

  const all = await ExtraOil.find({ transportId: scope.transportId }).sort({ date: -1 });
  const months = [...new Set(all.map((e) => ym(e.date)))].sort().reverse();
  const rows = period ? all.filter((e) => ym(e.date) === period) : all;

  const byDriver = new Map();
  const byTruck = new Map();
  const add = (map, key, label, e) => {
    const a = map.get(key) || { key, label, times: 0, totalL: 0, totalCost: 0 };
    a.times += 1; a.totalL += e.litres || 0; a.totalCost += e.cost || 0;
    map.set(key, a);
  };
  for (const e of rows) {
    add(byDriver, e.driverId ? String(e.driverId) : (e.driverName || "Unknown"), e.driverName || "Unknown", e);
    // Key the tanker by its registration so the same physical truck merges whether it was
    // logged by truckId or by raw vehicle number.
    add(byTruck, e.vehicleNo || (e.truckId ? String(e.truckId) : "Unknown"), e.vehicleNo || "Unknown", e);
  }
  const sortDesc = (arr) => arr.sort((a, b) => b.totalL - a.totalL || b.times - a.times);

  const totals = rows.reduce((t, e) => ({ times: t.times + 1, totalL: t.totalL + (e.litres || 0), totalCost: t.totalCost + (e.cost || 0) }),
    { times: 0, totalL: 0, totalCost: 0 });

  return NextResponse.json({
    byDriver: sortDesc([...byDriver.values()]),
    byTruck: sortDesc([...byTruck.values()]),
    totals,
    months,
  });
}
