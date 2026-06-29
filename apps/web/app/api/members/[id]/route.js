import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { User, toUser } from "@/lib/models";
import { hashPin } from "@/lib/auth/pin";
import { requireAuth } from "@/lib/auth/session";
import { unauth, forbidden } from "@/lib/api/scope";

async function loadMember(id, me) {
  const m = await User.findOne({ _id: id, role: { $in: ["manager", "driver"] } });
  if (!m) return null;
  // owner must own the member's transport-owner chain; manager must share transport.
  if (me.role === "owner" && String(m.createdByOwnerId) !== me.userId) return null;
  if (me.role === "manager" && String(m.transportId) !== me.transportId) return null;
  return m;
}

export async function PUT(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const m = await loadMember(params.id, me);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await request.json();
  if (b.name != null) m.name = String(b.name).trim();
  if (b.licenseNo != null) m.licenseNo = String(b.licenseNo).trim();
  if (b.joiningDate !== undefined) m.joiningDate = b.joiningDate ? new Date(`${String(b.joiningDate).slice(0, 10)}T12:00:00Z`) : null;
  if (b.assignedTruckId !== undefined) m.assignedTruckId = b.assignedTruckId || null;
  if (b.status === "active" || b.status === "disabled") m.status = b.status;
  // Owner/manager can grant or revoke a driver's app/web login.
  if (b.appAccessEnabled != null && m.role === "driver") m.appAccessEnabled = !!b.appAccessEnabled;
  if (b.pin) {
    if (!/^\d{4,6}$/.test(String(b.pin))) return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
    m.pinHash = hashPin(b.pin);
  }
  // Salary config is owner-only.
  if (me.role === "owner" && m.role === "driver") {
    if (b.salaryType) m.salaryType = b.salaryType === "per_trip" ? "per_trip" : "monthly";
    if (b.baseSalary != null) m.baseSalary = Number(b.baseSalary) || 0;
    if (b.shortageRatePerUnit != null) m.shortageRatePerUnit = Number(b.shortageRatePerUnit) || 0;
  } else if (me.role === "manager" && (b.baseSalary != null || b.shortageRatePerUnit != null)) {
    return forbidden("Only the owner can change salary settings");
  }
  await m.save();
  return NextResponse.json({ member: toUser(m) });
}

export async function DELETE(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const m = await loadMember(params.id, me);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await m.deleteOne();
  return NextResponse.json({ ok: true });
}
