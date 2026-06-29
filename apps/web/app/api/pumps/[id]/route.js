import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Pump, toClient } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { pumpUpdateSchema } from "@rtkm/shared";

export async function GET(request, { params }) {
  await dbConnect();
  const doc = await Pump.findById(params.id);
  if (!doc || doc.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ pump: toClient(doc) });
}

export async function PUT(request, { params }) {
  const admin = await requireAuth(request, { roles: ["admin"] });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const body = await request.json();
  const parsed = pumpUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  }
  const update = { ...parsed.data };
  // If coords were set manually, mark not auto-geocoded.
  if (update.lat != null || update.lng != null) update.geocoded = false;

  const doc = await Pump.findByIdAndUpdate(params.id, update, { new: true });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ pump: toClient(doc) });
}

// Soft-delete so the change propagates to mobile via /api/sync.
export async function DELETE(request, { params }) {
  const admin = await requireAuth(request, { roles: ["admin"] });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const doc = await Pump.findByIdAndUpdate(params.id, { isDeleted: true }, { new: true });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
