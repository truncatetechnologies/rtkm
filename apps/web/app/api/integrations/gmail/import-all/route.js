import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { accessTokenFromRefresh, listPdfAttachments, getAttachment } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { extractText } from "@/lib/pdf/extract";
import { processLedgerPdf } from "@/lib/services/ledger";
import { importFastagPdf } from "@/lib/services/fastag";
import { cleanSender, buildQuery, classify } from "@/lib/services/gmailImport";

const PRIORITY = { invoice: 0, freight: 1, fastag: 2, payment: 3, "": 9 };

// POST /api/integrations/gmail/import-all
//   { transportId, senders?: string[], days?: number, save?: boolean }
// Scans the connected inbox for PDF attachments (optionally only from given sender
// domains) and AUTO-FILES every one — invoices, freight statements, payment advices
// and FASTag/BlackBuck statements — skipping anything already imported (hash dedup).
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;

  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const senders = (Array.isArray(b.senders) ? b.senders : (conn.senders || []))
    .map(cleanSender).filter(Boolean);
  if (b.save) { conn.senders = senders; }

  // Custom date range (after/before) or a rolling N-day window; sender domains matched on from/to/cc.
  const q = buildQuery({ senders, days: b.days, after: b.after, before: b.before });
  const dayWin = Math.min(1825, Math.max(1, parseInt(b.days, 10) || 365));
  const window = (b.after || b.before) ? { after: b.after || null, before: b.before || null } : { days: dayWin };
  // Drop statement/invoice rows dated before the window start (statements cover the prior fortnight).
  const minDate = b.after || new Date(Date.now() - dayWin * 86400000).toISOString().slice(0, 10);

  try {
    const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
    const messages = await listPdfAttachments(token, q);

    // Download + classify everything first, then file in a safe order.
    const items = [];
    for (const m of messages) {
      try {
        const buffer = await getAttachment(token, m.messageId, m.attachmentId);
        const text = await extractText(buffer);
        items.push({ buffer, text, filename: m.filename, from: m.from, kind: classify(text) });
      } catch {
        items.push({ filename: m.filename, from: m.from, kind: "", failed: true });
      }
    }
    items.sort((a, z) => (PRIORITY[a.kind] ?? 9) - (PRIORITY[z.kind] ?? 9));

    const counts = { invoice: 0, freight: 0, payment: 0, fastag: 0, duplicates: 0, unrecognised: 0, failed: 0 };
    const results = [];
    for (const it of items) {
      if (it.failed) { counts.failed++; results.push({ filename: it.filename, status: "failed" }); continue; }
      if (!it.kind) { counts.unrecognised++; results.push({ filename: it.filename, status: "unrecognised" }); continue; }
      try {
        if (it.kind === "fastag") {
          const r = await importFastagPdf({ scope, buffer: it.buffer, filename: it.filename });
          if (r.duplicate) { counts.duplicates++; results.push({ filename: it.filename, status: "duplicate", kind: "fastag" }); }
          else { counts.fastag++; results.push({ filename: it.filename, status: "imported", kind: `fastag-${r.kind}` }); }
        } else {
          const r = await processLedgerPdf({ scope, buffer: it.buffer, filename: it.filename, text: it.text, force: true, minDate });
          if (r.duplicate) { counts.duplicates++; results.push({ filename: it.filename, status: "duplicate", kind: r.kind || it.kind }); }
          else if (!r.kind) { counts.unrecognised++; results.push({ filename: it.filename, status: "unrecognised" }); }
          else { counts[r.kind] = (counts[r.kind] || 0) + 1; results.push({ filename: it.filename, status: "imported", kind: r.kind, summary: r.summary || "" }); }
        }
      } catch (e) {
        counts.failed++;
        results.push({ filename: it.filename, status: "failed", error: String(e.message || e) });
      }
    }

    conn.lastScanAt = new Date();
    await conn.save();

    const imported = counts.invoice + counts.freight + counts.payment + counts.fastag;
    return NextResponse.json({ ok: true, scanned: messages.length, imported, senders, window, counts, results });
  } catch (e) {
    return NextResponse.json({ error: "Could not read Gmail: " + String(e.message || e) }, { status: 502 });
  }
}
