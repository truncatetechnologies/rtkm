import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { Load, Maintenance, SalaryRecord, Expense, ExtraOil, Truck, User, Transport, FastagTxn, FastagWalletTxn } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/reports/spend?transportId=&from=&to= — total spend by category + counts + by-month.
// from/to are ISO datetimes; when present, time-bound metrics are filtered to that window
// (fleet counts — trucks & drivers — always reflect the current fleet, not a date range).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const tId = new mongoose.Types.ObjectId(scope.transportId);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // Company/depot filter applies to load-based metrics (fuel, trips, shortage, pending invoice).
  // Maintenance / salaries / expenses aren't company-tagged, so they stay fleet-wide.
  const company = searchParams.get("company");
  const co = company && company !== "all" ? { company } : {};
  // Build a `{ field: { $gte, $lte } }` fragment for the given date field, or {} when unfiltered.
  const dateRange = (field) => {
    if (!from && !to) return {};
    const r = {};
    if (from) r.$gte = new Date(from);
    if (to) r.$lte = new Date(to);
    return { [field]: r };
  };

  const [fuelArr, maintArr, salArr, expArr, extraArr, trips, trucks, drivers, pendingInvoice, openShort] = await Promise.all([
    Load.aggregate([{ $match: { transportId: tId, ...co, ...dateRange("loadDate") } }, { $group: { _id: null, v: { $sum: "$oilCost" }, oil: { $sum: "$oilLiters" }, meal: { $sum: "$mealAllowance" } } }]),
    Maintenance.aggregate([{ $match: { transportId: tId, ...dateRange("date") } }, { $group: { _id: null, v: { $sum: "$cost" } } }]),
    SalaryRecord.aggregate([{ $match: { transportId: tId, status: "paid", ...dateRange("paidAt") } }, { $group: { _id: null, v: { $sum: "$netPay" } } }]),
    Expense.aggregate([{ $match: { transportId: tId, ...dateRange("date") } }, { $group: { _id: null, v: { $sum: "$amount" } } }]),
    ExtraOil.aggregate([{ $match: { transportId: tId, ...dateRange("date") } }, { $group: { _id: null, v: { $sum: "$cost" }, oil: { $sum: "$litres" }, n: { $sum: 1 } } }]),
    Load.countDocuments({ transportId: tId, ...co, ...dateRange("loadDate") }),
    Truck.countDocuments({ transportId: tId }),
    User.countDocuments({ transportId: tId, role: "driver" }),
    Load.countDocuments({ transportId: tId, hasInvoice: false, invoiceAck: { $ne: true }, ...co, ...dateRange("loadDate") }),
    Load.aggregate([{ $match: { transportId: tId, ...co, ...dateRange("loadDate") } }, { $group: { _id: null, s: { $sum: "$shortageL" } } }]),
  ]);

  // Diesel given to drivers becomes a real ₹ cost via the transport's diesel price (₹/L).
  const tr = await Transport.findById(scope.transportId).select("dieselPrice");
  const dieselPrice = tr?.dieselPrice || 0;
  const oilLiters = fuelArr[0]?.oil || 0;
  const fuel = Math.round(oilLiters * dieselPrice);
  const mealAllowance = Math.round(fuelArr[0]?.meal || 0); // flat per-trip driver meal allowance
  const maintenance = maintArr[0]?.v || 0;
  const salaries = salArr[0]?.v || 0;
  const expenses = expArr[0]?.v || 0;
  const extraOilCost = extraArr[0]?.v || 0;
  const extraOilL = extraArr[0]?.oil || 0;
  const extraOilCount = extraArr[0]?.n || 0;

  // FASTag: tolls (real cost) + non-toll BlackBuck fees net of refunds. Fleet-wide (not company-scoped).
  const [fTollArr, fWalletArr] = await Promise.all([
    FastagTxn.aggregate([{ $match: { transportId: tId, type: "toll", ...dateRange("txnDate") } }, { $group: { _id: null, v: { $sum: "$amount" } } }]),
    FastagWalletTxn.aggregate([{ $match: { transportId: tId, ...dateRange("txnDate") } }, { $group: { _id: "$category", v: { $sum: "$amount" } } }]),
  ]);
  const tolls = fTollArr[0]?.v || 0;
  const wc = Object.fromEntries(fWalletArr.map((d) => [d._id, d.v]));
  // net wallet outflow = all debits − all non-topup credits; fees = outflow beyond tolls.
  const fastagOutflow = (wc.recharge || 0) + (wc.orderpayment || 0) + (wc.servicefee || 0) - (wc.recharge_reversal || 0) - (wc.refund || 0);
  const fastag = Math.max(tolls, fastagOutflow);
  const fastagFees = Math.max(0, fastag - tolls);

  const byMonth = await Load.aggregate([
    { $match: { transportId: tId, ...co, ...dateRange("loadDate") } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$loadDate" } }, trips: { $sum: 1 }, fuel: { $sum: "$oilCost" }, shortageL: { $sum: "$shortageL" } } },
    { $sort: { _id: -1 } }, { $limit: 12 },
  ]);

  return NextResponse.json({
    totals: {
      fuel, maintenance, salaries, expenses, extraOilCost, extraOilL, extraOilCount, dieselPrice,
      tolls, fastagFees, fastag, mealAllowance,
      total: fuel + maintenance + salaries + expenses + extraOilCost + fastag + mealAllowance,
      trips, trucks, drivers, pendingInvoice,
      oilLiters,
      shortageL: openShort[0]?.s || 0,
    },
    byMonth: byMonth.map((m) => ({ month: m._id, trips: m.trips, fuel: m.fuel, shortageL: m.shortageL })),
  });
}
