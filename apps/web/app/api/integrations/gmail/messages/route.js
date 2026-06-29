import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { accessTokenFromRefresh, listPdfAttachments } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";

// GET /api/integrations/gmail/messages?transportId=&q= — list inbox PDF attachments.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  try {
    const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
    const q = searchParams.get("q") || "has:attachment filename:pdf newer_than:60d";
    const messages = await listPdfAttachments(token, q);
    conn.lastScanAt = new Date();
    await conn.save();
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json({ error: "Could not read Gmail: " + String(e.message || e) }, { status: 502 });
  }
}
