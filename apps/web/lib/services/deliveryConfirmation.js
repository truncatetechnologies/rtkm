import { dbConnect } from "@/lib/mongoose";
import { Load, Shortage, Truck, User, GmailConnection } from "@/lib/models";
import { accessTokenFromRefresh, listMessageIds, getMessageText } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { createNotification } from "@/lib/services/notifications";

// dd.mm.yyyy → Date at UTC noon (timezone-safe month grouping).
function parseDotDate(s) {
  const m = String(s || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : null;
}

// Parse Nayara's "Delivery confirmation" email (Loss/Gain table in the body — no PDF).
// This arrives within days of delivery, so we capture the shortage EARLY for salary, well
// before the monthly Statement-of-Freight PDF. Returns { company, shipmentNo, rows } or null.
export function parseDeliveryConfirmation(subject, text) {
  const all = `${subject || ""}\n${text || ""}`;
  if (!/delivery confirmation/i.test(all) && !/Loss\s*\/\s*Gain/i.test(all)) return null;
  const company = /nayara/i.test(all) ? "nayara" : /bharat|bpcl/i.test(all) ? "bpcl" : /hindustan|hpcl/i.test(all) ? "hpcl" : "";
  const shipMatch = all.match(/shipment\s*(?:number)?\s*(\d{6,})/i);
  const shipmentNo = shipMatch ? shipMatch[1] : "";
  const flat = all.replace(/\s+/g, " ");
  // Row tail: <reg> … <dd.mm.yyyy> <invoiceNo(10)> <loaded> <delivered> <shortage>
  const re = /([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})[\s\S]*?(\d{2}\.\d{2}\.\d{4})\s+(\d{10})\s+(\d+)\s+(\d+)\s+(\d+)/g;
  const rows = [];
  for (const m of flat.matchAll(re)) {
    rows.push({
      vehicle: m[1].replace(/\s/g, "").toUpperCase(), invoiceDate: m[2], invoiceNo: m[3],
      loaded: +m[4], delivered: +m[5], shortage: +m[6], shipmentNo,
    });
  }
  return rows.length ? { company, shipmentNo, rows } : null;
}

// Scan Gmail for delivery-confirmation emails, upsert the load's delivered/shortage qty, and create
// the per-driver Shortage (deduped by invoice number, so the later freight-statement PDF won't
// double-count it). Feeds salary deductions early.
export async function syncDeliveryConfirmations({ scope, days = 365 }) {
  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return { error: "Gmail not connected" };
  const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));

  const d = Math.min(1825, Math.max(1, parseInt(days, 10) || 365));
  const q = `("delivery confirmation for the shipment" OR "delivery confirmation for Shipment" OR "Details of Loss / Gain") newer_than:${d}d`;
  const ids = await listMessageIds(token, q);

  const trucks = await Truck.find({ transportId: scope.transportId }).select("registrationNo assignedDriverId");
  const truckByReg = {};
  trucks.forEach((t) => { if (t.registrationNo) truckByReg[t.registrationNo.replace(/\s/g, "").toUpperCase()] = t; });

  let parsed = 0, shortagesCreated = 0;
  for (const id of ids) {
    let msg;
    try { msg = await getMessageText(token, id); } catch { continue; }
    const res = parseDeliveryConfirmation(msg.subject, msg.text || msg.snippet);
    if (!res) continue;
    for (const r of res.rows) {
      parsed++;
      const truck = truckByReg[r.vehicle];
      const driverId = truck?.assignedDriverId || null;
      const date = parseDotDate(r.invoiceDate) || (msg.dateMs ? new Date(msg.dateMs) : new Date());

      // Upsert the load — set delivery/shortage facts, but never touch freight/rtkm/pump (may come
      // from the tax invoice or the freight statement).
      const set = {
        ownerId: scope.ownerId, transportId: scope.transportId,
        vehicleNo: r.vehicle, shipmentNo: r.shipmentNo || "", invoiceDate: date, loadDate: date,
        deliveredQtyL: r.delivered, shortageL: r.shortage,
      };
      if (truck) set.truckId = truck._id;
      if (driverId) set.driverId = driverId;
      const load = await Load.findOneAndUpdate(
        { transportId: scope.transportId, invoiceNumber: r.invoiceNo },
        { $set: set, $setOnInsert: { invoiceNumber: r.invoiceNo, loadQtyL: r.loaded, company: res.company } },
        { upsert: true, new: true }
      );

      // Create the driver shortage once (dedup by invoice number — shared with the freight importer).
      if (r.shortage > 0 && driverId) {
        const dup = await Shortage.findOne({ transportId: scope.transportId, invoiceNumber: r.invoiceNo });
        if (!dup) {
          const driver = await User.findById(driverId).select("shortageRatePerUnit");
          const rate = driver?.shortageRatePerUnit || 0;
          await Shortage.create({
            ownerId: scope.ownerId, transportId: scope.transportId, loadId: load._id, driverId,
            invoiceNumber: r.invoiceNo, shortageL: r.shortage, ratePerUnit: rate, shortageValue: r.shortage * rate,
            status: "open", reportedAt: date, notes: "Auto from delivery-confirmation email",
          });
          shortagesCreated++;
          await createNotification({
            ownerId: scope.ownerId, transportId: scope.transportId, type: "shortage",
            title: "Shortage reported (delivery confirmation)",
            body: `${r.vehicle} — inv ${r.invoiceNo}: ${r.shortage}L short`,
            link: "/app/shortages", dedupeKey: `delconf:${r.invoiceNo}`,
          });
        }
      }
    }
  }
  return { scanned: ids.length, parsed, shortagesCreated };
}
