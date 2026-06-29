import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

// GET /api/auth/owner/me -> current member identity, or 401
export async function GET(request) {
  const me = await requireAuth(request, { roles: ["owner", "manager", "driver", "admin"] });
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({
    userId: me.userId,
    role: me.role,
    name: me.name,
    transportId: me.transportId,
    ownerId: me.ownerId,
  });
}
