import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { SalaryRecord } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";
import { discardPayslip } from "@/lib/services/salary";

// DELETE /api/salary/:id — discard a draft payslip (owner). Releases its shortage deductions.
export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner"] });
  if (!me) return unauth();
  await dbConnect();
  const slip = await SalaryRecord.findById(params.id);
  if (!slip || !(await canAccessTransport(me, slip.transportId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const r = await discardPayslip(slip);
  if (r.error) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true });
}
