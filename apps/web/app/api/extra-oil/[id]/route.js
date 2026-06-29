import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { ExtraOil } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// DELETE /api/extra-oil/:id — remove an extra-diesel entry (owner/manager).
export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const item = await ExtraOil.findById(params.id);
  if (!item || !(await canAccessTransport(me, item.transportId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await item.deleteOne();
  return NextResponse.json({ ok: true });
}
