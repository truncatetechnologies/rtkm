import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Shortage, toShortage, SalaryRecord } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/shortages?transportId=&status= (owner/manager)
// Each shortage is tagged with whether it's been deducted from a salary and which month's payslip
// — so late depot shortages (arriving 15/30/45 days later) are trackable: deducted vs still pending.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const filter = { transportId: scope.transportId };
  if (searchParams.get("status")) filter.status = searchParams.get("status");
  if (searchParams.get("driverId")) filter.driverId = searchParams.get("driverId");
  const items = await Shortage.find(filter).sort({ reportedAt: -1 }).limit(500);

  // Resolve the payslip month + paid state for any deducted shortages.
  const slipIds = [...new Set(items.filter((i) => i.payslipId).map((i) => String(i.payslipId)))];
  let byId = {};
  if (slipIds.length) {
    const slips = await SalaryRecord.find({ _id: { $in: slipIds } }).select("period status");
    byId = Object.fromEntries(slips.map((s) => [String(s._id), { period: s.period, paid: s.status === "paid" }]));
  }
  const shortages = items.map((i) => {
    const o = toShortage(i);
    const p = i.payslipId ? byId[String(i.payslipId)] : null;
    return { ...o, deductedPeriod: p?.period || "", deductedPaid: !!p?.paid };
  });
  return NextResponse.json({ shortages });
}
