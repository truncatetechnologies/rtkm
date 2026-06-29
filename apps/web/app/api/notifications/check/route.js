import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { accessTokenFromRefresh, listPdfAttachments } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { createNotification } from "@/lib/services/notifications";

// POST /api/notifications/check { transportId } — scan the connected Gmail for new invoice/PDF
// attachments and raise a notification for each one not seen before (deduped by message+attachment).
// Called by the app on load + when the bell polls; a cron can hit this for background delivery.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();

  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return NextResponse.json({ created: 0, connected: false });

  try {
    const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
    // Only look at mail since we last scanned (first run: last 14 days) to keep it light.
    const since = conn.lastScanAt ? Math.max(1, Math.ceil((Date.now() - new Date(conn.lastScanAt).getTime()) / 86400000)) : 14;
    const messages = await listPdfAttachments(token, `has:attachment filename:pdf newer_than:${since}d`);
    let created = 0;
    for (const m of messages) {
      const n = await createNotification({
        ownerId: scope.ownerId, transportId: scope.transportId, type: "gmail",
        title: "New PDF in Gmail", body: `${m.filename}${m.from ? ` — from ${m.from}` : ""}`,
        link: "/app/ledger", dedupeKey: `gmail:${m.messageId}:${m.attachmentId}`,
      });
      // createNotification returns the existing doc on dedupe — only count genuinely new ones.
      if (n && n.createdAt && Date.now() - new Date(n.createdAt).getTime() < 10000) created++;
    }
    conn.lastScanAt = new Date();
    await conn.save();
    return NextResponse.json({ created, scanned: messages.length, connected: true });
  } catch (e) {
    return NextResponse.json({ created: 0, connected: true, error: String(e.message || e) });
  }
}
