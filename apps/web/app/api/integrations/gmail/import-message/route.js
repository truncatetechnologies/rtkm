import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { accessTokenFromRefresh, getMessagePdfParts, getAttachment } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { autoFileBuffer, tallyResults } from "@/lib/services/gmailImport";

// POST /api/integrations/gmail/import-message { transportId, messageId }
// Auto-files every PDF attachment of ONE email (FASTag or ledger; dedup by hash). Short request,
// so the client can loop over scan-ids with a live progress counter and never hit a timeout.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  if (!b.messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  try {
    const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
    const { parts } = await getMessagePdfParts(token, b.messageId);
    const only = b.only || null; // e.g. "invoice" → pre-load invoices only
    const minDate = b.minDate || null; // drop deliveries/invoices older than the import start date
    const results = [];
    for (const p of parts) {
      try {
        const buffer = await getAttachment(token, b.messageId, p.attachmentId);
        results.push(await autoFileBuffer({ scope, buffer, filename: p.filename, only, minDate }));
      } catch (e) {
        results.push({ status: "failed", filename: p.filename, error: String(e.message || e) });
      }
    }
    const counts = tallyResults(results);
    const imported = counts.invoice + counts.freight + counts.payment + counts.fastag;
    return NextResponse.json({ ok: true, pdfs: parts.length, imported, counts, results });
  } catch (e) {
    return NextResponse.json({ error: "Could not read Gmail: " + String(e.message || e) }, { status: 502 });
  }
}
