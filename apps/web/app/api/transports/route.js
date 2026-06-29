import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Transport, toTransport } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// GET /api/transports — owner: own transports; manager/driver: their one transport
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["owner", "manager", "driver"] });
  if (!me) return unauth();
  await dbConnect();
  let transports;
  if (me.role === "owner") transports = await Transport.find({ ownerId: me.userId }).sort({ createdAt: -1 });
  else transports = me.transportId ? await Transport.find({ _id: me.transportId }) : [];
  return NextResponse.json({ transports: transports.map(toTransport) });
}

// POST /api/transports (owner)
export async function POST(request) {
  const me = await requireAuth(request, { roles: ["owner"] });
  if (!me) return unauth();
  await dbConnect();
  const b = await request.json();
  if (!b.name || !b.name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const tr = await Transport.create({
    ownerId: me.userId,
    name: b.name.trim(),
    address: String(b.address || "").trim(),
    gstNo: String(b.gstNo || "").trim(),
    phone: String(b.phone || "").trim(),
    ...(Number(b.tankerAvg) > 0 ? { tankerAvg: Number(b.tankerAvg) } : {}),
  });
  return NextResponse.json({ transport: toTransport(tr) }, { status: 201 });
}
