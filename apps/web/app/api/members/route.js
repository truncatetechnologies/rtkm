import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { User, toUser } from "@/lib/models";
import { hashPin } from "@/lib/auth/pin";
import { resolveScope } from "@/lib/api/scope";

function normPhone(p) { return String(p || "").replace(/[^\d+]/g, ""); }

// GET /api/members?transportId=&role= — managers/drivers in a transport
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;

  const filter = { transportId: scope.transportId, role: { $in: ["manager", "driver"] } };
  const role = searchParams.get("role");
  if (role === "manager" || role === "driver") filter.role = role;

  const members = await User.find(filter).sort({ role: 1, name: 1 });
  return NextResponse.json({ members: members.map(toUser) });
}

// POST /api/members — create a manager or driver under a transport
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();

  const role = b.role === "manager" ? "manager" : "driver";
  // Managers may only create drivers.
  if (scope.identity.role === "manager" && role !== "driver") {
    return NextResponse.json({ error: "Managers can only add drivers" }, { status: 403 });
  }

  const ph = normPhone(b.phone);
  if (!b.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (ph.length < 7) return NextResponse.json({ error: "Valid phone required" }, { status: 400 });
  if (!/^\d{4,6}$/.test(String(b.pin || ""))) return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
  if (await User.findOne({ phone: ph })) return NextResponse.json({ error: "Phone already registered" }, { status: 409 });

  const user = await User.create({
    role,
    name: b.name.trim(),
    phone: ph,
    pinHash: hashPin(b.pin),
    status: "active",
    transportId: scope.transportId,
    createdByOwnerId: scope.ownerId,
    salaryType: b.salaryType === "per_trip" ? "per_trip" : "monthly",
    baseSalary: Number(b.baseSalary) || 0,
    shortageRatePerUnit: Number(b.shortageRatePerUnit) || 0,
    licenseNo: String(b.licenseNo || "").trim(),
    joiningDate: b.joiningDate ? new Date(`${String(b.joiningDate).slice(0, 10)}T12:00:00Z`) : null,
    assignedTruckId: b.assignedTruckId || null,
    appAccessEnabled: role === "driver" ? !!b.appAccessEnabled : true,
  });
  return NextResponse.json({ member: toUser(user) }, { status: 201 });
}
