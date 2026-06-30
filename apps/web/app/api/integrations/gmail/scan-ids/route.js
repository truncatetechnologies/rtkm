import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { accessTokenFromRefresh, listMessageIds } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { cleanSender, buildQuery } from "@/lib/services/gmailImport";

// POST /api/integrations/gmail/scan-ids { transportId, senders?, days?, after?, before?, save? }
// FAST first step of bulk import: returns the matching message IDs (oldest-first) so the client
// can import them one-by-one with progress. No attachments downloaded here.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;

  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const senders = (Array.isArray(b.senders) ? b.senders : (conn.senders || [])).map(cleanSender).filter(Boolean);
  if (b.save) conn.senders = senders;

  const q = buildQuery({ senders, days: b.days, after: b.after, before: b.before });

  try {
    const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
    const ids = await listMessageIds(token, q);
    conn.lastScanAt = new Date();
    await conn.save();
    return NextResponse.json({ ok: true, ids, count: ids.length, query: q });
  } catch (e) {
    return NextResponse.json({ error: "Could not read Gmail: " + String(e.message || e) }, { status: 502 });
  }
}
