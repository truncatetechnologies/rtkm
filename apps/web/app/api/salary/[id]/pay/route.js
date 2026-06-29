import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { SalaryRecord, toSalary } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// POST /api/salary/:id/pay (owner) — mark a payslip paid
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner"] });
  if (!me) return unauth();
  await dbConnect();
  const slip = await SalaryRecord.findById(params.id);
  if (!slip || !(await canAccessTransport(me, slip.transportId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  slip.status = "paid";
  slip.paidAt = new Date();
  await slip.save();
  return NextResponse.json({ payslip: toSalary(slip) });
}
