import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Leave } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// DELETE /api/leaves/:id — remove a leave entry (owner/manager). Regenerate the payslip to apply.
export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const item = await Leave.findById(params.id);
  if (!item || !(await canAccessTransport(me, item.transportId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await item.deleteOne();
  return NextResponse.json({ ok: true });
}
