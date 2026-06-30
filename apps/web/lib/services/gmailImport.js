import { extractText } from "@/lib/pdf/extract";
import { detectLedgerKind, parseFreightStatement, parsePaymentAdvice } from "@/lib/pdf/ledger";
import { parseInvoice } from "@/lib/pdf/parsers";
import { detectFastagKind } from "@/lib/pdf/fastag";
import { processLedgerPdf } from "@/lib/services/ledger";
import { importFastagPdf } from "@/lib/services/fastag";

// Shared helpers for Gmail bulk import (used by scan-ids + import-message + import-all).

// Normalise a sender entry to a Gmail `from:` term. "@nayaraenergy.com" / "nayaraenergy.com"
// → bare domain (matches every address there); a full address is kept as-is.
export function cleanSender(s) {
  return String(s || "").trim().replace(/^from:/i, "").replace(/^@/, "").trim();
}

// Format a date string (ISO / YYYY-MM-DD) to Gmail's `YYYY/MM/DD`, optionally shifting N days.
export function ymd(str, addDays = 0) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// Build the Gmail search query from a custom date range (after/before) or a rolling N-day window,
// plus an optional sender-domain filter.
export function buildQuery({ senders = [], days, after, before }) {
  let q = "has:attachment filename:pdf";
  const a = ymd(after);
  const b = ymd(before, 1); // +1 day so the chosen "to" date is included
  if (a || b) {
    if (a) q += ` after:${a}`;
    if (b) q += ` before:${b}`;
  } else {
    const d = Math.min(1825, Math.max(1, parseInt(days, 10) || 365));
    q += ` newer_than:${d}d`;
  }
  if (senders.length) {
    // Match the domain anywhere on the envelope — NOT just the sender. Bank payment advices come
    // FROM the bank (e.g. icici.bank.in) but CC the oil company (epayadvice@nayaraenergy.com), so a
    // from-only filter would miss them. from OR to OR cc catches statements, invoices and advices.
    const grp = senders.join(" OR ");
    q += ` (from:(${grp}) OR to:(${grp}) OR cc:(${grp}))`;
  }
  return q;
}

// Classify a PDF from its text without writing anything.
export function classify(text) {
  if (detectFastagKind(text)) return "fastag";
  const lk = detectLedgerKind(text); // "freight" | "payment" | "" (phrase match)
  if (lk) return lk;
  const inv = parseInvoice(text);
  if (inv.fields?.invoiceNumber && (inv.confidence === "high" || inv.fields.pumpCode)) return "invoice";
  if (parseFreightStatement(text).rows.length) return "freight";
  if (parsePaymentAdvice(text).lines.length) return "payment";
  return "";
}

// Auto-detect a single PDF buffer and file it (FASTag or ledger), de-duped by content hash.
// `only` (e.g. "invoice") restricts to one kind — used to pre-load invoices that precede the
// statements that reference them, without importing those earlier statements/payments.
// Returns a per-file result: { status: "imported"|"duplicate"|"unrecognised"|"skipped", kind?, summary? }.
export async function autoFileBuffer({ scope, buffer, filename, only, minDate = null }) {
  const text = await extractText(buffer);
  const kind = classify(text);
  if (!kind) return { status: "unrecognised", filename };
  if (only && kind !== only) return { status: "skipped", kind, filename };
  if (kind === "fastag") {
    const r = await importFastagPdf({ scope, buffer, filename });
    return r.duplicate
      ? { status: "duplicate", kind: "fastag", filename }
      : { status: "imported", kind: `fastag-${r.kind}`, filename };
  }
  const r = await processLedgerPdf({ scope, buffer, filename, text, force: true, minDate });
  if (r.skipped) return { status: "skipped", kind: r.kind || kind, filename };       // older than start date
  if (r.duplicate) return { status: "duplicate", kind: r.kind || kind, filename };
  if (!r.kind) return { status: "unrecognised", filename };
  // A freight statement whose every row was before the start date created nothing.
  if (r.kind === "freight" && !r.created && !r.updated) return { status: "skipped", kind: "freight", filename };
  return { status: "imported", kind: r.kind, summary: r.summary || "", filename };
}

// Roll a list of per-file results into counts (matches the shape the UI renders).
export function tallyResults(results, counts = { invoice: 0, freight: 0, payment: 0, fastag: 0, duplicates: 0, unrecognised: 0, failed: 0, skipped: 0 }) {
  for (const r of results) {
    if (!r) { counts.failed++; continue; }
    if (r.status === "duplicate") counts.duplicates++;
    else if (r.status === "unrecognised") counts.unrecognised++;
    else if (r.status === "skipped") counts.skipped = (counts.skipped || 0) + 1;
    else if (r.status === "failed") counts.failed++;
    else if (r.status === "imported") {
      if (String(r.kind || "").startsWith("fastag")) counts.fastag++;
      else counts[r.kind] = (counts[r.kind] || 0) + 1;
    }
  }
  return counts;
}
