import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Load, toLoad } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// GET /api/me/loads — a driver's own trips
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["driver"] });
  if (!me) return unauth();
  await dbConnect();
  const loads = await Load.find({ driverId: me.userId }).sort({ loadDate: -1 }).limit(300);
  return NextResponse.json({ loads: loads.map(toLoad) });
}
