import { NextResponse } from "next/server";
import { clearOwnerCookie } from "@/lib/ownerCookie";

// POST /api/auth/owner/logout
export async function POST() {
  return clearOwnerCookie(NextResponse.json({ ok: true }));
}
