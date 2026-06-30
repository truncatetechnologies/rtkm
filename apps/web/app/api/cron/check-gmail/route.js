import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { accessTokenFromRefresh, listPdfAttachments } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { createNotification } from "@/lib/services/notifications";
import { buildQuery, cleanSender } from "@/lib/services/gmailImport";

// GET/POST /api/cron/check-gmail  (header: Authorization: Bearer <CRON_SECRET>, or ?secret=)
// Scans every connected Gmail inbox for new invoice/PDF attachments FROM THE CONFIGURED SENDERS only
// and raises notifications (which fire OS push). Inboxes with no senders set are skipped so unrelated
// PDFs don't notify — the owner sets trusted senders in Settings → Gmail. Schedule every few minutes.
async function run(request) {
  const { searchParams } = new URL(request.url);
  const secret = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || searchParams.get("secret") || "";
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const conns = await GmailConnection.find({ refreshTokenEnc: { $ne: "" } });
  let totalNew = 0;
  for (const conn of conns) {
    try {
      // Only alert for trusted senders (oil company / bank). No senders configured → skip this inbox
      // entirely, so random personal PDFs never notify. Owner configures these in Settings → Gmail.
      const senders = (conn.senders || []).map(cleanSender).filter(Boolean);
      if (!senders.length) { conn.lastScanAt = new Date(); await conn.save(); continue; }
      const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
      const since = conn.lastScanAt ? Math.max(1, Math.ceil((Date.now() - new Date(conn.lastScanAt).getTime()) / 86400000)) : 7;
      const messages = await listPdfAttachments(token, buildQuery({ senders, days: since }));
      for (const m of messages) {
        const n = await createNotification({
          ownerId: conn.ownerId, transportId: conn.transportId, type: "gmail",
          title: "New PDF in Gmail", body: `${m.filename}${m.from ? ` — from ${m.from}` : ""}`,
          link: "/app/ledger", dedupeKey: `gmail:${m.messageId}:${m.attachmentId}`,
        });
        if (n && n.createdAt && Date.now() - new Date(n.createdAt).getTime() < 10000) totalNew++;
      }
      conn.lastScanAt = new Date();
      await conn.save();
    } catch { /* skip this inbox, continue */ }
  }
  return NextResponse.json({ ok: true, inboxes: conns.length, newNotifications: totalNew });
}

export const GET = run;
export const POST = run;
