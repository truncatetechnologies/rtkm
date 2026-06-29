import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { SalaryRecord, toSalary, Shortage, toShortage } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// GET /api/me/payslips — a driver's own payslips + open shortages
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["driver"] });
  if (!me) return unauth();
  await dbConnect();
  const [slips, openShortages] = await Promise.all([
    SalaryRecord.find({ driverId: me.userId }).sort({ period: -1 }).limit(60),
    Shortage.find({ driverId: me.userId, status: "open" }).sort({ reportedAt: -1 }),
  ]);
  const payslips = slips.map(toSalary);
  const pendingSalary = payslips.filter((p) => p.status !== "paid").reduce((s, p) => s + (p.netPay || 0), 0);
  const paidSalary = payslips.filter((p) => p.status === "paid").reduce((s, p) => s + (p.netPay || 0), 0);
  const openShortageValue = openShortages.reduce((s, x) => s + (x.shortageValue || 0), 0);
  return NextResponse.json({
    payslips,
    openShortages: openShortages.map(toShortage),
    summary: { pendingSalary, paidSalary, openShortageValue, lastNetPay: payslips[0]?.netPay || 0 },
  });
}
