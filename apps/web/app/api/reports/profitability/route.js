import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { Load, ExtraOil, Maintenance, SalaryRecord, Transport, FastagTxn, FastagWalletTxn } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/reports/profitability?transportId=
// Monthly profit = freight RECEIVED in bank − (driver diesel + extra oil + maintenance + salaries paid).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const tId = new mongoose.Types.ObjectId(scope.transportId);
  const MONTH = { format: "%Y-%m" };
  const tr = await Transport.findById(scope.transportId).select("dieselPrice");
  const dieselPrice = tr?.dieselPrice || 0;

  const [loadAgg, extraAgg, maintAgg, salAgg, tollAgg, walletAgg] = await Promise.all([
    Load.aggregate([{ $match: { transportId: tId } }, { $group: { _id: { $dateToString: { ...MONTH, date: "$loadDate" } }, received: { $sum: "$netReceived" }, oil: { $sum: "$oilLiters" }, meal: { $sum: "$mealAllowance" }, freight: { $sum: "$freightAmount" }, trips: { $sum: 1 } } }]),
    ExtraOil.aggregate([{ $match: { transportId: tId } }, { $group: { _id: { $dateToString: { ...MONTH, date: "$date" } }, v: { $sum: "$cost" } } }]),
    Maintenance.aggregate([{ $match: { transportId: tId } }, { $group: { _id: { $dateToString: { ...MONTH, date: "$date" } }, v: { $sum: "$cost" } } }]),
    SalaryRecord.aggregate([{ $match: { transportId: tId, status: "paid" } }, { $group: { _id: "$period", v: { $sum: "$netPay" } } }]),
    FastagTxn.aggregate([{ $match: { transportId: tId, type: "toll" } }, { $group: { _id: "$period", v: { $sum: "$amount" } } }]),
    FastagWalletTxn.aggregate([{ $match: { transportId: tId } }, { $group: { _id: { period: "$period", category: "$category" }, v: { $sum: "$amount" } } }]),
  ]);

  const months = {};
  const row = (m) => (months[m] = months[m] || { month: m, received: 0, freight: 0, fuel: 0, extraOil: 0, maintenance: 0, salaries: 0, fastag: 0, mealAllowance: 0, trips: 0 });
  loadAgg.forEach((d) => { if (!d._id) return; const r = row(d._id); r.received += d.received || 0; r.fuel += Math.round((d.oil || 0) * dieselPrice); r.mealAllowance += d.meal || 0; r.freight += d.freight || 0; r.trips += d.trips || 0; });
  extraAgg.forEach((d) => { if (d._id) row(d._id).extraOil += d.v || 0; });
  maintAgg.forEach((d) => { if (d._id) row(d._id).maintenance += d.v || 0; });
  salAgg.forEach((d) => { if (d._id) row(d._id).salaries += d.v || 0; });
  // FASTag cost per month = max(tolls, net wallet outflow) — matches the spend/FASTag report.
  const tollsM = {}; tollAgg.forEach((d) => { if (d._id) tollsM[d._id] = d.v || 0; });
  const outM = {};
  walletAgg.forEach((d) => {
    const p = d._id.period; if (!p) return; outM[p] = outM[p] || 0;
    const c = d._id.category, v = d.v || 0;
    if (c === "recharge" || c === "orderpayment" || c === "servicefee") outM[p] += v;
    else if (c === "recharge_reversal" || c === "refund") outM[p] -= v;
  });
  [...new Set([...Object.keys(tollsM), ...Object.keys(outM)])].forEach((m) => { row(m).fastag = Math.max(tollsM[m] || 0, outM[m] || 0); });

  const rows = Object.values(months).map((r) => {
    const costs = r.fuel + r.extraOil + r.maintenance + r.salaries + r.fastag + r.mealAllowance;
    return { ...r, costs, profit: r.received - costs };
  }).sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 12);

  const totals = rows.reduce((t, r) => ({
    received: t.received + r.received, freight: t.freight + r.freight, fuel: t.fuel + r.fuel,
    extraOil: t.extraOil + r.extraOil, maintenance: t.maintenance + r.maintenance, salaries: t.salaries + r.salaries,
    fastag: t.fastag + r.fastag, mealAllowance: t.mealAllowance + r.mealAllowance, costs: t.costs + r.costs, profit: t.profit + r.profit,
  }), { received: 0, freight: 0, fuel: 0, extraOil: 0, maintenance: 0, salaries: 0, fastag: 0, mealAllowance: 0, costs: 0, profit: 0 });

  return NextResponse.json({ rows, totals });
}
