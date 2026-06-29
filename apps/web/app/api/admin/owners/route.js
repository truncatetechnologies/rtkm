import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { User, toUser, Truck, Load } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// GET /api/admin/owners — list truck owners with quick counts
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const owners = await User.find({ role: "owner" }).sort({ createdAt: -1 }).limit(1000);

  const withCounts = await Promise.all(
    owners.map(async (o) => {
      const [trucks, loads] = await Promise.all([
        Truck.countDocuments({ ownerId: o._id }),
        Load.countDocuments({ ownerId: o._id }),
      ]);
      return { ...toUser(o), trucks, loads };
    })
  );
  return NextResponse.json({ owners: withCounts });
}
