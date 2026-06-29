import fs from "fs/promises";
import path from "path";
import { dbConnect } from "@/lib/mongoose";
import { Load, Truck, User, Shortage, Settlement, Upload, Transport } from "@/lib/models";
import { extractText } from "@/lib/pdf/extract";
import { detectLedgerKind, parseFreightStatement, parsePaymentAdvice } from "@/lib/pdf/ledger";
import { parseInvoice } from "@/lib/pdf/parsers";
import { lookupRtkm, lookupPumps, reconcileRtkm } from "@/lib/pdf/ingest";
import { sha256 } from "@/lib/crypto";
import { calcOil } from "@rtkm/shared";
import { createNotification } from "@/lib/services/notifications";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseFlexDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  // Anchor to UTC noon so month/day grouping is timezone-safe.
  let m = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/); // dd.mm.yyyy[ time] or dd/mm/yyyy
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12));
  m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/); // 30-Apr-2026
  if (m) return new Date(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()] ?? 0, +m[1], 12));
  return null;
}

// Auto-create/upsert a load from a parsed tax-invoice (same logic as the manual confirm, no form).
async function createLoadFromInvoice(scope, f) {
  const reg = String(f.truckReg || "").replace(/\s/g, "").toUpperCase();
  let truck = null;
  if (reg) {
    const trucks = await Truck.find({ transportId: scope.transportId });
    truck = trucks.find((t) => (t.registrationNo || "").replace(/\s/g, "").toUpperCase() === reg) || null;
  }
  const driverId = truck?.assignedDriverId || null;
  const rtkm = Number(f.rtkm) || (await lookupRtkm(scope.transportId, f.pumpCode)) || 0;
  const averageKmL = 4;
  const loadQtyL = Number(f.loadQtyL) || 0;
  const date = parseFlexDate(f.invoiceDate);
  const set = {
    ownerId: scope.ownerId, transportId: scope.transportId, company: f.company || "",
    invoiceDate: date, loadDate: date || new Date(),
    fromLocation: f.fromLocation || "", toLocation: f.toLocation || f.roName || "",
    pumpCode: f.pumpCode || "", cmsCode: f.pumpCode || "", roName: f.roName || "",
    vehicleNo: String(f.truckReg || "").toUpperCase(), driverName: f.driverName || "",
    product: f.product || "", shipmentNo: f.shipmentNo || "", lrNumber: f.lrNumber || "",
    supplyLocation: f.supplyLocation || "", notes: f.address || "",
    loadQtyL, deliveredQtyL: loadQtyL, rtkm, averageKmL, oilLiters: calcOil(rtkm, averageKmL) || 0,
    hasInvoice: true, // this load now has its source Tax Invoice
  };
  if (truck) set.truckId = truck._id;
  if (driverId) set.driverId = driverId;
  const existed = await Load.findOne({ transportId: scope.transportId, invoiceNumber: f.invoiceNumber }).select("_id");
  const load = await Load.findOneAndUpdate(
    { transportId: scope.transportId, invoiceNumber: f.invoiceNumber },
    { $set: set, $setOnInsert: { invoiceNumber: f.invoiceNumber } },
    { upsert: true, new: true }
  );
  // Sync master RTKM from the invoice's own RTKM (auto-fill empty / queue mismatch for approval).
  if (Number(f.rtkm) > 0 && f.pumpCode) {
    await reconcileRtkm({ transportId: scope.transportId, ownerId: scope.ownerId, source: "invoice",
      rows: [{ cmsCode: f.pumpCode, rtkm: f.rtkm, invoiceNumber: f.invoiceNumber }] });
  }
  return { load, created: !existed, truckReg: reg, truckInFleet: !!truck, driverAssigned: !!driverId };
}
const stripZeros = (s) => String(s || "").replace(/^0+/, "");
const rupeeStr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

// PDFs are parsed in memory and not persisted (keeps the app filesystem-free for Vercel).
// Kept as a no-op so callers/Upload.path stay unchanged.
async function saveFile() {
  return "";
}

// Club loads by Shipment No and (re)compute the diesel given to the driver.
// Rule (per the owner): one shipment can drop at several pumps, but the tanker only drives to the
// FARTHEST pump and back — so oil is based on the MAX RTKM in the shipment, not the sum, and given
// once. oil = ceil(maxRtkm / tankerAvg). It's attributed to the "lead" load (the farthest pump) so
// summing oilLiters across loads never double-counts a shipment. Loads with no Shipment No are their
// own single-load shipment.
export async function recomputeShipmentOil(scope) {
  await dbConnect();
  const transport = await Transport.findById(scope.transportId).select("tankerAvg dieselPrice mealAllowancePerTrip");
  const avg = Number(transport?.tankerAvg) > 0 ? Number(transport.tankerAvg) : 4.5;
  // Global diesel price (₹/L) — stamped on every load so oilCost in the ledger matches reports.
  const price = Number(transport?.dieselPrice) || 0;
  const mealDefault = Number(transport?.mealAllowancePerTrip) || 0;
  const loads = await Load.find({ transportId: scope.transportId });

  const groups = new Map(); // key -> [loads]
  for (const l of loads) {
    const key = l.shipmentNo ? `s:${l.shipmentNo}` : `i:${l._id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }

  for (const members of groups.values()) {
    const maxRtkm = members.reduce((mx, m) => Math.max(mx, m.rtkm || 0), 0);
    const oil = avg > 0 ? Math.ceil(maxRtkm / avg) : 0;
    // Lead = the farthest pump (max rtkm); ties keep the first.
    let lead = members[0];
    for (const m of members) if ((m.rtkm || 0) > (lead.rtkm || 0)) lead = m;
    // Meal allowance is carried once per trip on the lead load. A manual per-trip override (set on
    // any member) wins; otherwise it follows the transport default.
    const manual = members.find((m) => m.mealAllowanceManual);
    const tripMeal = manual ? (manual.mealAllowance || 0) : mealDefault;
    for (const m of members) {
      const isLead = String(m._id) === String(lead._id);
      const ol = isLead ? oil : 0;
      const oilCost = ol * price;
      const meal = isLead ? tripMeal : 0;
      const mealManual = isLead ? !!manual : false;
      // Only write when something actually changed (avoids needless saves on every upload).
      if (m.shipmentMaxRtkm !== maxRtkm || m.shipmentOilLiters !== oil || m.shipmentLead !== isLead ||
          m.averageKmL !== avg || m.oilLiters !== ol || m.ratePerL !== price || m.oilCost !== oilCost ||
          m.mealAllowance !== meal || m.mealAllowanceManual !== mealManual) {
        m.shipmentMaxRtkm = maxRtkm; m.shipmentOilLiters = oil; m.shipmentLead = isLead;
        m.averageKmL = avg; m.oilLiters = ol; m.ratePerL = price; m.oilCost = oilCost;
        m.mealAllowance = meal; m.mealAllowanceManual = mealManual;
        await m.save();
      }
    }
  }
}

// Summary shown to the owner right after an invoice is filed: the whole shipment this load belongs
// to, its total vs farthest (longest) RTKM, and the diesel the driver should get for the trip —
// computed from the global tanker average + diesel price. Loads with no Shipment No stand alone.
export async function shipmentSummaryForLoad(scope, load) {
  await dbConnect();
  const transport = await Transport.findById(scope.transportId).select("tankerAvg dieselPrice mealAllowancePerTrip");
  const avg = Number(transport?.tankerAvg) > 0 ? Number(transport.tankerAvg) : 4.5;
  const price = Number(transport?.dieselPrice) || 0;
  const mealDefault = Number(transport?.mealAllowancePerTrip) || 0;
  const filter = load.shipmentNo
    ? { transportId: scope.transportId, shipmentNo: load.shipmentNo }
    : { _id: load._id };
  const members = await Load.find(filter).select("rtkm roName cmsCode loadQtyL mealAllowance mealAllowanceManual shipmentLead");
  const maxRtkm = members.reduce((mx, m) => Math.max(mx, m.rtkm || 0), 0);
  const totalRtkm = members.reduce((s, m) => s + (m.rtkm || 0), 0);
  const dieselLiters = avg > 0 ? Math.ceil(maxRtkm / avg) : 0;
  // Meal allowance for the trip: the lead load carries it; manual override pins a custom value.
  const lead = members.find((m) => m.shipmentLead) || members[0];
  const mealManual = members.some((m) => m.mealAllowanceManual);
  const mealAllowance = lead ? (lead.mealAllowance || 0) : mealDefault;
  return {
    shipmentNo: load.shipmentNo || "",
    loadId: String(load._id),
    loadCount: members.length,
    totalRtkm, maxRtkm,
    tankerAvg: avg, dieselPrice: price, dieselLiters,
    dieselAmount: Math.round(dieselLiters * price),
    mealAllowance, mealAllowanceDefault: mealDefault, mealAllowanceManual: mealManual,
    stops: members.map((m) => ({ roName: m.roName || m.cmsCode || "", rtkm: m.rtkm || 0 })).sort((a, b) => b.rtkm - a.rtkm),
  };
}

// Freight statement → upsert loads (estimated freight) + per-litre driver shortages.
export async function importFreightStatement({ scope, parsed }) {
  await dbConnect();
  const trucks = await Truck.find({ transportId: scope.transportId });
  const truckByReg = {};
  trucks.forEach((t) => { if (t.registrationNo) truckByReg[t.registrationNo.replace(/\s/g, "").toUpperCase()] = t; });

  // Pull pump name (+ fallback RTKM) for every customer code in the statement, in one query.
  const pumpInfo = await lookupPumps(scope.transportId, parsed.rows.map((r) => r.customerCode));

  let created = 0, updated = 0, shortagesCreated = 0;
  const createdLoadIds = [], createdShortageIds = [];
  for (const r of parsed.rows) {
    const truck = truckByReg[(r.vehicle || "").replace(/\s/g, "").toUpperCase()];
    const driverId = truck?.assignedDriverId || null;
    const date = parseFlexDate(r.invoiceDate);
    const shortageL = +(r.shortageKL * 1000).toFixed(2);
    const pi = pumpInfo[String(r.customerCode || "").trim()] || {};
    const fields = {
      ownerId: scope.ownerId, transportId: scope.transportId, company: parsed.company,
      invoiceNumber: r.salesInvNo, invoiceDate: date, loadDate: date || new Date(),
      shipmentNo: r.shipmentNo, deliveryDocument: r.deliveryDoc, supplyLocation: r.supplyLocation,
      cmsCode: r.customerCode, vehicleNo: r.vehicle || "", product: r.product,
      loadQtyL: Math.round(r.saleQtyKL * 1000), deliveredQtyL: Math.round(r.deliveryQtyKL * 1000), shortageL,
      rtkm: r.rtkm || pi.rtkm || 0, freightRate: r.freightRate, freightAmount: r.freightAmount,
    };
    if (pi.roName) fields.roName = pi.roName; // don't wipe a name already set from an invoice
    if (truck) fields.truckId = truck._id;
    if (driverId) fields.driverId = driverId;

    let load = await Load.findOne({ transportId: scope.transportId, invoiceNumber: r.salesInvNo });
    if (load) { Object.assign(load, fields); await load.save(); updated++; }
    else { load = await Load.create(fields); created++; createdLoadIds.push(load._id); }

    // Per-litre driver shortage (keep existing mechanism). Idempotent by invoice.
    if (shortageL > 0 && driverId) {
      const dup = await Shortage.findOne({ transportId: scope.transportId, invoiceNumber: r.salesInvNo });
      if (!dup) {
        const driver = await User.findById(driverId);
        const rate = driver?.shortageRatePerUnit || 0;
        const sh = await Shortage.create({
          ownerId: scope.ownerId, transportId: scope.transportId, loadId: load._id, driverId,
          invoiceNumber: r.salesInvNo, shortageL, ratePerUnit: rate, shortageValue: shortageL * rate,
          status: "open", reportedAt: date || new Date(), notes: "Auto from freight statement",
        });
        createdShortageIds.push(sh._id);
        shortagesCreated++;
      }
    }
  }
  await recomputeShipmentOil(scope); // club by shipment & set diesel given (max RTKM / avg)
  // Keep master RTKM in sync (auto-fill empty, queue mismatches for admin approval).
  await reconcileRtkm({ transportId: scope.transportId, ownerId: scope.ownerId, source: "freight",
    rows: parsed.rows.map((r) => ({ cmsCode: r.customerCode, rtkm: r.rtkm, invoiceNumber: r.salesInvNo })) });
  return { created, updated, shortagesCreated, createdLoadIds, createdShortageIds };
}

// Payment advice → match lines to loads, capture gross/TDS/deduction/net, mark settled.
export async function reconcilePayment({ scope, parsed }) {
  await dbConnect();
  const loads = await Load.find({ transportId: scope.transportId });
  const byInvoice = new Map();   // salesInvoiceNo -> load
  const byShipment = new Map();  // shipmentNo -> [loads]  (a shipment may cover several invoices)
  loads.forEach((l) => {
    if (l.invoiceNumber) byInvoice.set(l.invoiceNumber, l);
    if (l.shipmentNo) { const a = byShipment.get(l.shipmentNo) || []; a.push(l); byShipment.set(l.shipmentNo, a); }
  });

  // For a payment line, find the load(s) it pays for.
  const matchTargets = (line) => {
    // 1) exact sales-invoice (e.g. the shortage debit line "8050729664")
    if (byInvoice.has(line.invoiceNumber)) return [byInvoice.get(line.invoiceNumber)];
    if (byInvoice.has(line.ref)) return [byInvoice.get(line.ref)];
    // 2) shipment (bank pays per shipment; ref/invoice = "00" + shipmentNo)
    const ship = [stripZeros(line.ref), stripZeros(line.invoiceNumber)].find((s) => byShipment.has(s));
    return ship ? byShipment.get(ship) : null;
  };

  const acc = new Map(); // loadId -> { load, gross, tds, ded }
  const ensure = (l) => { let a = acc.get(String(l._id)); if (!a) { a = { load: l, gross: 0, tds: 0, ded: 0 }; acc.set(String(l._id), a); } return a; };
  const unmatched = [];

  for (const line of parsed.lines) {
    const targets = matchTargets(line);
    if (!targets || !targets.length) { unmatched.push(line.invoiceNumber || line.ref); continue; }
    // distribute across targets weighted by their freight amount (handles multi-invoice shipments)
    const totalW = targets.reduce((s, l) => s + (l.freightAmount || 0), 0) || targets.length;
    targets.forEach((l) => {
      const share = targets.length === 1 ? 1 : ((l.freightAmount || 0) || 1) / totalW;
      const a = ensure(l);
      if (line.gross >= 0) { a.gross += line.gross * share; a.tds += line.tds * share; }
      else { a.ded += Math.abs(line.gross) * share; }
    });
  }

  const valueDate = parseFlexDate(parsed.valueDate);
  const settlementDoc = {
    ownerId: scope.ownerId, transportId: scope.transportId, company: parsed.company,
    paymentDocNo: parsed.paymentDocNo, utr: parsed.utr, valueDate: parsed.valueDate, total: parsed.total,
    matchedCount: acc.size, unmatchedRefs: unmatched, lines: parsed.lines,
  };
  // One settlement per payment document — re-uploading updates it rather than duplicating.
  const settlement = parsed.paymentDocNo
    ? await Settlement.findOneAndUpdate({ transportId: scope.transportId, paymentDocNo: parsed.paymentDocNo }, settlementDoc, { upsert: true, new: true })
    : await Settlement.create(settlementDoc);

  let totalReceived = 0, totalGross = 0, totalTds = 0, totalDed = 0;
  for (const a of acc.values()) {
    const gross = Math.round(a.gross * 100) / 100, tds = Math.round(a.tds * 100) / 100, ded = Math.round(a.ded * 100) / 100;
    const net = Math.round((gross - tds - ded) * 100) / 100;
    totalReceived += net; totalGross += gross; totalTds += tds; totalDed += ded;
    Object.assign(a.load, {
      tdsAmount: tds, nayaraShortageDeduction: ded, netReceived: net,
      settlementStatus: gross > 0 ? "settled" : a.load.settlementStatus,
      paymentRef: parsed.paymentDocNo, paidDate: valueDate, settlementId: settlement._id,
    });
    await a.load.save();
  }
  return {
    matched: acc.size, unmatched: unmatched.length, unmatchedRefs: unmatched,
    totalReceived: Math.round(totalReceived * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    totalTds: Math.round(totalTds * 100) / 100,
    totalDed: Math.round(totalDed * 100) / 100,
    checkTotal: parsed.total,
    settlementId: settlement._id,
    affectedLoadIds: [...acc.values()].map((a) => a.load._id),
  };
}

// Read-only: how many payment lines would (not) match an existing delivery — used to warn
// "invoice/load not in the system" BEFORE writing anything.
async function dryRunPaymentMatch(scope, parsed) {
  const loads = await Load.find({ transportId: scope.transportId }).select("invoiceNumber shipmentNo");
  const byInvoice = new Map(), byShipment = new Map();
  loads.forEach((l) => {
    if (l.invoiceNumber) byInvoice.set(l.invoiceNumber, true);
    if (l.shipmentNo) byShipment.set(l.shipmentNo, true);
  });
  const unmatchedRefs = [];
  let matched = 0;
  for (const line of parsed.lines) {
    const hit = byInvoice.has(line.invoiceNumber) || byInvoice.has(line.ref) ||
      byShipment.has(stripZeros(line.ref)) || byShipment.has(stripZeros(line.invoiceNumber));
    if (hit) matched++; else unmatchedRefs.push(line.invoiceNumber || line.ref);
  }
  return { matched, unmatched: unmatchedRefs.length, unmatchedRefs };
}

// Undo everything an upload did: delete records it created; un-settle loads a bank advice settled.
export async function revertUpload({ scope, upload }) {
  await dbConnect();
  if (upload.reverted) return { error: "This upload was already reverted." };

  let deletedLoads = 0, deletedShortages = 0, unsettled = 0;

  if (upload.createdShortageIds?.length) {
    deletedShortages = (await Shortage.deleteMany({ _id: { $in: upload.createdShortageIds } })).deletedCount || 0;
  }
  if (upload.createdLoadIds?.length) {
    // remove any shortages still attached to the loads we're deleting, then the loads
    await Shortage.deleteMany({ transportId: scope.transportId, loadId: { $in: upload.createdLoadIds } });
    deletedLoads = (await Load.deleteMany({ _id: { $in: upload.createdLoadIds }, transportId: scope.transportId })).deletedCount || 0;
  }
  if (upload.affectedLoadIds?.length) {
    unsettled = (await Load.updateMany(
      { _id: { $in: upload.affectedLoadIds }, transportId: scope.transportId },
      { $set: { tdsAmount: 0, nayaraShortageDeduction: 0, netReceived: 0, settlementStatus: "pending", paymentRef: "", paidDate: null, settlementId: null } }
    )).modifiedCount || 0;
  }
  if (upload.settlementRef) await Settlement.deleteOne({ _id: upload.settlementRef });

  if (deletedLoads) await recomputeShipmentOil(scope); // a deleted pump may change its shipment's max RTKM

  upload.reverted = true;
  upload.revertedAt = new Date();
  await upload.save();
  return { deletedLoads, deletedShortages, unsettled };
}

// Detect doc kind by STRUCTURE (not just the title), parse, run the right pipeline.
// A freight/delivery statement is identified by its row pattern; a payment advice by its line pattern.
export async function processLedgerPdf({ scope, buffer, filename, force = false, text: pretext }) {
  await dbConnect();
  const text = pretext != null ? pretext : await extractText(buffer);
  const relPath = await saveFile(scope, buffer, filename).catch(() => "");
  const hash = sha256(buffer);
  const prior = await Upload.findOne({ transportId: scope.transportId, hash }).select("createdAt");
  const dup = { duplicate: !!prior, firstSeenAt: prior?.createdAt || null };
  const record = (kind, extra) => Upload.create({
    ownerId: scope.ownerId, transportId: scope.transportId, kind, hash,
    filename: filename || "", path: relPath, status: "linked", uploadedBy: scope.identity?.userId, ...extra,
  }).catch(() => null);

  // Freight / delivery statement — if any table rows parse, it's a statement (multi-invoice).
  const freight = parseFreightStatement(text);
  if (freight.rows.length) {
    // Which deliveries in this statement have no source Tax Invoice uploaded yet?
    const invNos = [...new Set(freight.rows.map((r) => r.salesInvNo).filter(Boolean))];
    const withInv = await Load.find({ transportId: scope.transportId, invoiceNumber: { $in: invNos }, hasInvoice: true }).select("invoiceNumber");
    const have = new Set(withInv.map((l) => l.invoiceNumber));
    const missingInvoices = invNos.filter((n) => !have.has(n));
    // Stop and ask before writing anything if invoices are missing (unless the user forced it).
    if (missingInvoices.length && !force) {
      return { kind: "freight", needsConfirm: true, missingInvoices, rows: freight.rows.length, company: freight.company, reference: freight.reference, ...dup };
    }
    const result = await importFreightStatement({ scope, parsed: freight });
    const up = await record("freight", {
      summary: `${result.created} new + ${result.updated} updated deliveries, ${result.shortagesCreated} shortage(s)`,
      createdLoadIds: result.createdLoadIds, createdShortageIds: result.createdShortageIds,
    });
    await createNotification({ ownerId: scope.ownerId, transportId: scope.transportId, type: "freight",
      title: "Statement of Freight imported", body: `${result.created} new + ${result.updated} updated deliveries`, link: "/app/ledger" });
    return { kind: "freight", company: freight.company, reference: freight.reference, uploadId: up && String(up._id), ...result, rows: freight.rows.length, validation: { missingInvoices }, ...dup };
  }

  // Bank payment advice
  const payment = parsePaymentAdvice(text);
  if (payment.lines.length) {
    // Stop and ask before settling if some payment lines have no matching delivery/invoice.
    if (!force) {
      const dry = await dryRunPaymentMatch(scope, payment);
      if (dry.unmatched > 0) {
        return { kind: "payment", needsConfirm: true, missingInvoices: dry.unmatchedRefs, matched: dry.matched, lines: payment.lines.length, total: payment.total, ...dup };
      }
    }
    const result = await reconcilePayment({ scope, parsed: payment });
    const up = await record("payment", {
      summary: `${result.matched} deliveries settled, ${rupeeStr(result.totalReceived)} received`,
      affectedLoadIds: result.affectedLoadIds, settlementRef: result.settlementId,
    });
    await createNotification({ ownerId: scope.ownerId, transportId: scope.transportId, type: "payment",
      title: "Bank payment reconciled", body: `${result.matched} deliveries settled · ${rupeeStr(result.totalReceived)} received`, link: "/app/ledger" });
    return { kind: "payment", total: payment.total, lines: payment.lines.length, uploadId: up && String(up._id), ...result, settlementId: String(result.settlementId), validation: { missingInvoices: result.unmatchedRefs || [] }, ...dup };
  }

  // Single tax invoice → auto-create the load (dates read from the invoice itself)
  const inv = parseInvoice(text);
  if (inv.fields?.invoiceNumber && (inv.confidence === "high" || inv.fields.pumpCode)) {
    const { load, created, truckReg, truckInFleet, driverAssigned } = await createLoadFromInvoice(scope, inv.fields);
    await recomputeShipmentOil(scope); // a new invoice may extend its shipment's max RTKM
    const shipment = await shipmentSummaryForLoad(scope, load); // total/longest RTKM + diesel for the trip
    const up = await record("invoice", {
      summary: `Load ${load.invoiceNumber}${load.roName ? ` — ${load.roName}` : ""}`,
      createdLoadIds: created ? [load._id] : [],
    });
    // Validation: prompt to add the tanker / assign a driver if they're not in master data.
    const validation = {
      truckReg: truckReg || load.vehicleNo || "",
      driverName: inv.fields.driverName || "",
      needsTruck: !truckInFleet && !!(truckReg || load.vehicleNo),
      needsDriver: truckInFleet && !driverAssigned,
    };
    await createNotification({ ownerId: scope.ownerId, transportId: scope.transportId, type: "invoice",
      title: "Invoice imported", body: `${load.invoiceNumber}${load.roName ? ` — ${load.roName}` : ""}`, link: "/app/ledger" });
    return { kind: "invoice", invoiceNumber: load.invoiceNumber, roName: load.roName, pumpCode: load.cmsCode, rtkm: load.rtkm, shipment, uploadId: up && String(up._id), validation, ...dup };
  }

  const clean = (text || "").trim();
  return {
    kind: "",
    error: clean.length < 20
      ? "Couldn't read any text — this looks like a scanned/image PDF. Please upload the original digital PDF."
      : "Not recognised as a Statement of Freight or bank payment advice. The extracted text is shown below — share it so we can tune the parser.",
    textPreview: clean.slice(0, 2500),
    textLen: clean.length,
  };
}
