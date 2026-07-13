import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { accessTokenFromRefresh, listMessageIds, getMessagePdfParts, getAttachment } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { cleanSender, buildQuery, autoFileBuffer, tallyResults } from "@/lib/services/gmailImport";
import { syncDeliveryConfirmations } from "@/lib/services/deliveryConfirmation";
import { syncGateIns } from "@/lib/services/gateIn";
import { syncDocExpiry } from "@/lib/services/vehicleAlert";

// One manual "Sync" the owner can hit from any page when data looks missing.
// Deliberately only a few obvious periods — not a date-range builder.
export const SYNC_PERIODS = [
  { key: "today", label: "Today", days: 1 },
  { key: "week", label: "This week", days: 7 },
  { key: "month", label: "This month", days: 30 },
];
export function daysForPeriod(key) {
  return (SYNC_PERIODS.find((p) => p.key === key) || SYNC_PERIODS[1]).days;
}

// Which syncs each page actually needs, so a page only pulls what it shows.
export const PAGE_KINDS = {
  overview: ["gmail", "deliveries", "gateIn", "docExpiry"],
  loads: ["gmail"],
  ledger: ["gmail"],
  uploads: ["gmail"],
  fastag: ["gmail"],
  shortages: ["gmail", "deliveries"],
  gatein: ["gateIn"],
  alerts: ["docExpiry"],
};
export const ALL_KINDS = ["gmail", "deliveries", "gateIn", "docExpiry"];

// Pull + auto-file every PDF attachment in the period (freight statements, invoices, bank advices,
// FASTag). Bounded by maxMessages so a manual sync can never hang the request.
async function gmailPdfSync({ scope, days, maxMessages = 40 }) {
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return { skipped: true, reason: "Gmail not connected" };

  const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
  const senders = (conn.senders || []).map(cleanSender).filter(Boolean);
  const ids = (await listMessageIds(token, buildQuery({ senders, days }))).slice(0, maxMessages);

  const results = [];
  for (const id of ids) {
    let parts = [];
    try { ({ parts } = await getMessagePdfParts(token, id)); } catch { continue; } // unreadable → skip
    for (const p of parts) {
      try {
        const buffer = await getAttachment(token, id, p.attachmentId);
        results.push(await autoFileBuffer({ scope, buffer, filename: p.filename }));
      } catch (e) {
        results.push({ status: "failed", filename: p.filename, error: String(e.message || e) });
      }
    }
  }
  const counts = tallyResults(results);
  return { scanned: ids.length, imported: counts.invoice + counts.freight + counts.payment + counts.fastag, counts };
}

// Run the requested syncs for a period. Every kind is best-effort — one failing never kills the rest.
export async function runSync({ scope, kinds = [], days = 7 }) {
  await dbConnect();
  const detail = {};
  const errors = {};
  const run = async (key, fn) => {
    try { detail[key] = await fn(); }
    catch (e) { errors[key] = String(e.message || e); }
  };

  if (kinds.includes("gmail")) await run("gmail", () => gmailPdfSync({ scope, days }));
  if (kinds.includes("deliveries")) await run("deliveries", () => syncDeliveryConfirmations({ scope, days }));
  if (kinds.includes("gateIn")) await run("gateIn", () => syncGateIns({ scope, days }));
  if (kinds.includes("docExpiry")) await run("docExpiry", () => syncDocExpiry({ scope, days }));

  const imported = detail.gmail?.imported || 0;
  const shortages = detail.deliveries?.shortagesCreated || 0;
  const gateIns = detail.gateIn?.created || 0;
  const alerts = detail.docExpiry?.created || 0;
  const total = imported + shortages + gateIns + alerts;

  const bits = [];
  if (imported) bits.push(`${imported} document${imported === 1 ? "" : "s"}`);
  if (shortages) bits.push(`${shortages} shortage${shortages === 1 ? "" : "s"}`);
  if (gateIns) bits.push(`${gateIns} gate-in${gateIns === 1 ? "" : "s"}`);
  if (alerts) bits.push(`${alerts} alert${alerts === 1 ? "" : "s"}`);

  const notConnected = detail.gmail?.skipped || detail.deliveries?.error;
  const message = notConnected && !total
    ? "Gmail isn’t connected — connect it to import automatically."
    : total ? `Added ${bits.join(", ")}.` : "Nothing new found.";

  return { total, message, detail, errors: Object.keys(errors).length ? errors : undefined };
}
