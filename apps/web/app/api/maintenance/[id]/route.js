import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Maintenance, toMaintenance } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

async function loadItem(id, me) {
  const m = await Maintenance.findById(id);
  if (!m) return null;
  return (await canAccessTransport(me, m.transportId)) ? m : null;
}

export async function PUT(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const m = await loadItem(params.id, me);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await request.json();
  if (b.truckId !== undefined) m.truckId = b.truckId || null;
  if (b.date) m.date = new Date(b.date);
  ["category", "description", "vendor"].forEach((k) => { if (b[k] != null) m[k] = String(b[k]).trim(); });
  if (b.cost != null) m.cost = Number(b.cost) || 0;
  if (b.odometer != null) m.odometer = Number(b.odometer) || 0;
  await m.save();
  return NextResponse.json({ maintenance: toMaintenance(m) });
}

export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const m = await loadItem(params.id, me);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await m.deleteOne();
  return NextResponse.json({ ok: true });
}
