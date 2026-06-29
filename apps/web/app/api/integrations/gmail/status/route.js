import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection, toGmail } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/integrations/gmail/status?transportId=
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  return NextResponse.json({ gmail: toGmail(conn) || { connected: false } });
}
