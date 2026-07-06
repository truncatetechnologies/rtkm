import { dbConnect } from "@/lib/mongoose";
import { VehicleAlert, GmailConnection, Truck, toVehicleAlert } from "@/lib/models";
import { accessTokenFromRefresh, listMessageIds, getMessageText } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { createNotification } from "@/lib/services/notifications";

function parseDate(s) {
  const m = String(s || "").match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (!m) return null;
  let y = +m[3]; if (y < 100) y += 2000;
  return new Date(Date.UTC(y, +m[2] - 1, +m[1], 12));
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

// Parse a "vehicle document expiring" email → { company, rows:[{vehicleNo, certificate, expiryDate}] }.
// Built for Nayara's table wording; generic enough for BPCL / HPCL as their samples arrive.
export function parseDocExpiry(subject, text) {
  const all = `${subject || ""}\n${text || ""}`;
  if (!/expir/i.test(all)) return null; // must mention expiry
  const company = /nayara/i.test(all) ? "nayara" : /bharat|bpcl/i.test(all) ? "bpcl" : /hindustan|hpcl/i.test(all) ? "hpcl" : /indian\s*oil|iocl?\b/i.test(all) ? "ioc" : "";
  const flat = all.replace(/\s+/g, " ");
  // Each data row: <reg> <certificate name> <dd-mm-yyyy>
  const rowRe = /([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})\s+(.{1,60}?)\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g;
  const rows = [];
  for (const m of flat.matchAll(rowRe)) {
    rows.push({ vehicleNo: m[1].replace(/\s/g, "").toUpperCase(), certificate: m[2].replace(/\s+/g, " ").trim(), expiryDate: parseDate(m[3]) });
  }
  return rows.length ? { company, rows } : null;
}

// Scan Gmail for document-expiry alert emails, store them, and PUSH a notification for each new one.
export async function syncDocExpiry({ scope, days = 365 }) {
  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return { error: "Gmail not connected" };
  const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));

  const d = Math.min(1825, Math.max(1, parseInt(days, 10) || 365));
  const q = `("document Expiring" OR "will expire" OR "Expiry Date" OR "certificate" OR "permit") newer_than:${d}d`;
  const ids = await listMessageIds(token, q);

  const trucks = await Truck.find({ transportId: scope.transportId }).select("registrationNo");
  const truckByReg = {};
  trucks.forEach((t) => { if (t.registrationNo) truckByReg[t.registrationNo.replace(/\s/g, "").toUpperCase()] = t._id; });

  let parsed = 0, created = 0;
  for (const id of ids) {
    let msg;
    try { msg = await getMessageText(token, id); } catch { continue; }
    const res = parseDocExpiry(msg.subject, msg.text || msg.snippet);
    if (!res) continue;
    for (const row of res.rows) {
      parsed++;
      const doc = {
        ownerId: scope.ownerId, transportId: scope.transportId,
        vehicleNo: row.vehicleNo, truckId: truckByReg[row.vehicleNo] || null,
        certificate: row.certificate, expiryDate: row.expiryDate, company: res.company,
        receivedAt: msg.dateMs ? new Date(msg.dateMs) : null, messageId: id, subject: msg.subject || "",
      };
      const up = await VehicleAlert.updateOne(
        { transportId: scope.transportId, messageId: id, vehicleNo: row.vehicleNo, certificate: row.certificate },
        { $set: doc }, { upsert: true }
      );
      if (up.upsertedCount) {
        created++;
        await createNotification({
          ownerId: scope.ownerId, transportId: scope.transportId, type: "alert",
          title: "Vehicle document expiring",
          body: `${row.vehicleNo} — ${row.certificate}${row.expiryDate ? ` expires ${fmtDate(row.expiryDate)}` : ""}`,
          link: "/app/alerts", dedupeKey: `alert:${id}:${row.vehicleNo}:${row.certificate}`,
        });
      }
    }
  }
  return { scanned: ids.length, parsed, created };
}

export async function alertList({ scope }) {
  await dbConnect();
  const rows = await VehicleAlert.find({ transportId: scope.transportId }).sort({ expiryDate: 1 }).limit(1000);
  return { rows: rows.map(toVehicleAlert), total: rows.length };
}
