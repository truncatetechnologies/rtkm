import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Transport, User, Truck, Load } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// GET /api/admin/transports — every transporter (all owners) with headline counts. View-only (admin).
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();

  const transports = await Transport.find({}).sort({ createdAt: -1 }).limit(2000);
  const owners = await User.find({ role: "owner" }).select("name phone");
  const ownerById = new Map(owners.map((o) => [String(o._id), o]));

  const rows = await Promise.all(
    transports.map(async (t) => {
      const [trucks, tankers, drivers, loads] = await Promise.all([
        Truck.countDocuments({ transportId: t._id }),
        Truck.countDocuments({ transportId: t._id, type: "tanker" }),
        User.countDocuments({ transportId: t._id, role: "driver" }),
        Load.countDocuments({ transportId: t._id }),
      ]);
      const o = ownerById.get(String(t.ownerId));
      return {
        id: String(t._id), name: t.name || "—", active: t.active !== false,
        ownerName: o?.name || "—", ownerPhone: o?.phone || "",
        trucks, tankers, drivers, loads,
      };
    })
  );
  return NextResponse.json({ transports: rows });
}
