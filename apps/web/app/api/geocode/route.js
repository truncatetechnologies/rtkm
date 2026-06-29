import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { geocode } from "@/lib/geocode";

// POST /api/geocode { address }  (admin) -> { lat, lng, provider }
export async function POST(request) {
  const admin = await requireAuth(request, { roles: ["admin"] });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { address } = await request.json();
  if (!address || !address.trim()) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  const result = await geocode(address);
  if (!result) return NextResponse.json({ error: "No match found" }, { status: 404 });
  return NextResponse.json(result);
}
