import { dbConnect } from "@/lib/mongoose";
import { GateIn, GmailConnection, Truck, toGateIn } from "@/lib/models";
import { accessTokenFromRefresh, listMessageIds, getMessageText } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { createNotification } from "@/lib/services/notifications";

const REG = /[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}/;

// Parse a depot Gate-In / Gate-Out notification email into { vehicleNo, depot, company, direction }.
// Built for Nayara Kanpur's wording; the patterns are generic enough to extend to BPCL / HPCL / IOC
// and other depots as their sample emails arrive (add depot patterns to DEPOT_PATTERNS below).
const DEPOT_PATTERNS = [
  /DEPOT\s+LOCATION\s+(.+?)\s*[.\n\r]/i,   // Nayara: "...AT DEPOT LOCATION Nayara kanpur ."
  /at\s+depot[:\s]+(.+?)\s*[.\n\r]/i,
  /(?:depot|terminal|location)\s*[:\-]\s*(.+?)\s*[.\n\r]/i,
];
export function parseGateIn(subject, text) {
  const all = `${subject || ""}\n${text || ""}`;
  if (!/gate\s*[- ]?\s*(in|out)/i.test(all)) return null; // must be a gate event
  const direction = /gate\s*[- ]?\s*out/i.test(all) ? "out" : "in";

  // Vehicle: prefer the reg next to "TT number"; else any registration in the mail.
  const near = all.match(/TT\s*(?:number|no\.?)?\s*[:\-]?\s*([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})/i);
  const reg = (near?.[1] || all.match(REG)?.[0] || "").replace(/\s/g, "").toUpperCase();
  if (!reg) return null;

  let depot = "";
  for (const p of DEPOT_PATTERNS) { const m = all.match(p); if (m) { depot = m[1].trim(); break; } }

  const company = /nayara/i.test(all) ? "nayara"
    : /bharat|bpcl/i.test(all) ? "bpcl"
    : /hindustan|hpcl/i.test(all) ? "hpcl"
    : /indian\s*oil|iocl?\b/i.test(all) ? "ioc" : "";

  return { vehicleNo: reg, depot, company, direction };
}

// Scan the connected inbox for gate-in/out emails, parse and store them (idempotent by messageId).
export async function syncGateIns({ scope, days = 365 }) {
  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return { error: "Gmail not connected" };
  const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));

  const d = Math.min(1825, Math.max(1, parseInt(days, 10) || 365));
  const q = `("gate in" OR "gate out" OR "gate-in" OR "TT number") newer_than:${d}d`;
  const ids = await listMessageIds(token, q);

  const trucks = await Truck.find({ transportId: scope.transportId }).select("registrationNo");
  const truckByReg = {};
  trucks.forEach((t) => { if (t.registrationNo) truckByReg[t.registrationNo.replace(/\s/g, "").toUpperCase()] = t._id; });

  let parsed = 0, created = 0;
  for (const id of ids) {
    let msg;
    try { msg = await getMessageText(token, id); } catch { continue; }
    const g = parseGateIn(msg.subject, msg.text || msg.snippet);
    if (!g) continue;
    parsed++;
    const doc = {
      ownerId: scope.ownerId, transportId: scope.transportId,
      vehicleNo: g.vehicleNo, truckId: truckByReg[g.vehicleNo] || null,
      depot: g.depot, company: g.company, direction: g.direction,
      gateAt: msg.dateMs ? new Date(msg.dateMs) : null,
      messageId: id, subject: msg.subject || "", snippet: (msg.text || msg.snippet || "").replace(/\s+/g, " ").trim().slice(0, 240),
    };
    const res = await GateIn.updateOne({ transportId: scope.transportId, messageId: id }, { $set: doc }, { upsert: true });
    if (res.upsertedCount) {
      created++;
      await createNotification({
        ownerId: scope.ownerId, transportId: scope.transportId, type: "gatein",
        title: g.direction === "out" ? "Tanker gate-out" : "Tanker gate-in",
        body: `${g.vehicleNo}${g.depot ? ` — ${g.depot}` : ""}`,
        link: "/app/gate-in", dedupeKey: `gatein:${id}`,
      });
    }
  }
  return { scanned: ids.length, parsed, created };
}

// List stored gate events (newest first), optionally filtered by tanker.
export async function gateInList({ scope, vehicleNo }) {
  await dbConnect();
  const filter = { transportId: scope.transportId };
  if (vehicleNo) filter.vehicleNo = String(vehicleNo).replace(/\s/g, "").toUpperCase();
  const rows = await GateIn.find(filter).sort({ gateAt: -1 }).limit(1000);
  const byDepot = {};
  rows.forEach((r) => { const k = r.depot || "—"; byDepot[k] = (byDepot[k] || 0) + 1; });
  return {
    rows: rows.map(toGateIn),
    total: rows.length,
    byDepot: Object.entries(byDepot).map(([depot, count]) => ({ depot, count })).sort((a, b) => b.count - a.count),
  };
}
