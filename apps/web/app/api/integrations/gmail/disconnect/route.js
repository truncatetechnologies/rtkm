import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// POST /api/integrations/gmail/disconnect { transportId }
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();
  await GmailConnection.deleteOne({ transportId: scope.transportId });
  return NextResponse.json({ ok: true });
}
