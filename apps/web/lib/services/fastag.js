import { dbConnect } from "@/lib/mongoose";
import { FastagTxn, FastagWalletTxn, Truck, Upload, toWalletTxn } from "@/lib/models";
import { detectFastagKind, parseFastagTag, parseBossWallet } from "@/lib/pdf/fastag";
import { extractText } from "@/lib/pdf/extract";
import { sha256 } from "@/lib/crypto";

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseDate(s) { // "2 May 26"
  const m = String(s || "").match(/(\d{1,2})\s+(\w{3})\w*\s+(\d{2})/);
  if (!m) return null;
  const mo = MONTHS[m[2].toLowerCase()];
  if (mo == null) return null;
  return new Date(Date.UTC(2000 + +m[3], mo, +m[1], 12));
}
const ym = (d) => (d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : "");

function categorize(sign, desc) {
  if (/Top-Up/i.test(desc)) return "topup";
  if (/Order Payment/i.test(desc)) return "orderpayment";
  if (/Service Fee Refund/i.test(desc)) return "refund";
  if (/Service fee/i.test(desc)) return "servicefee";
  if (/FasTag Recharge/i.test(desc)) return sign > 0 ? "recharge_reversal" : "recharge";
  return "other";
}

// Detect + import a BlackBuck FASTag PDF (BOSS wallet or per-tanker). Idempotent by txnId.
export async function importFastagPdf({ scope, buffer, filename }) {
  await dbConnect();
  const text = await extractText(buffer);
  const kind = detectFastagKind(text);
  if (!kind) return { error: "Not a BlackBuck FASTag statement (BOSS wallet or per-tanker).", textPreview: (text || "").slice(0, 1500) };

  // Duplicate guard: same file (by content hash) already uploaded for this transport → skip re-processing.
  const hash = sha256(buffer);
  const prior = await Upload.findOne({ transportId: scope.transportId, hash }).select("createdAt kind");
  if (prior) return { kind: prior.kind === "fastag-tag" ? "tag" : "boss", duplicate: true, firstSeenAt: prior.createdAt };

  const trucks = await Truck.find({ transportId: scope.transportId }).select("registrationNo");
  const truckByReg = {};
  trucks.forEach((t) => { if (t.registrationNo) truckByReg[t.registrationNo.replace(/\s/g, "").toUpperCase()] = t._id; });

  if (kind === "tag") {
    const { truck, rows } = parseFastagTag(text);
    let tolls = 0, tollSum = 0, created = 0;
    for (const r of rows) {
      const d = parseDate(r.date);
      const doc = {
        ownerId: scope.ownerId, transportId: scope.transportId, provider: "blackbuck",
        truckId: truckByReg[truck] || null, vehicleNo: truck, type: r.type, amount: r.amount,
        plaza: r.plaza || "", txnId: r.txnId || "", txnDate: d, period: ym(d),
      };
      if (r.txnId) {
        const res = await FastagTxn.updateOne({ transportId: scope.transportId, txnId: r.txnId }, { $set: doc }, { upsert: true });
        if (res.upsertedCount) created++;
      } else { await FastagTxn.create(doc); created++; }
      if (r.type === "toll") { tolls++; tollSum += r.amount; }
    }
    await Upload.create({ ownerId: scope.ownerId, transportId: scope.transportId, kind: "fastag-tag", hash, filename: filename || "", status: "linked", uploadedBy: scope.identity?.userId }).catch(() => {});
    return { kind: "tag", truck, inFleet: !!truckByReg[truck], tolls, tollSum, created };
  }

  // BOSS wallet
  const { rows } = parseBossWallet(text);
  let created = 0;
  for (const r of rows) {
    const d = parseDate(r.date);
    const doc = {
      ownerId: scope.ownerId, transportId: scope.transportId, provider: "blackbuck",
      sign: r.sign, desc: r.desc, category: categorize(r.sign, r.desc), amount: r.amount,
      vehicleNo: r.truck || "", txnId: r.txnId || "", txnDate: d, period: ym(d),
    };
    if (r.txnId) {
      const res = await FastagWalletTxn.updateOne({ transportId: scope.transportId, txnId: r.txnId }, { $set: doc }, { upsert: true });
      if (res.upsertedCount) created++;
    } else { await FastagWalletTxn.create(doc); created++; }
  }
  await Upload.create({ ownerId: scope.ownerId, transportId: scope.transportId, kind: "fastag-boss", hash, filename: filename || "", status: "linked", uploadedBy: scope.identity?.userId }).catch(() => {});
  return { kind: "boss", rows: rows.length, created };
}

// Reconcile tolls (per-tanker truth) against the wallet, and surface non-toll / mismatched charges.
export async function fastagReport({ scope, period }) {
  await dbConnect();
  const tFilter = { transportId: scope.transportId, type: "toll", ...(period ? { period } : {}) };
  const wFilter = { transportId: scope.transportId, ...(period ? { period } : {}) };
  const [tolls, wallet] = await Promise.all([FastagTxn.find(tFilter), FastagWalletTxn.find(wFilter)]);

  const months = [...new Set([...(await FastagTxn.distinct("period", { transportId: scope.transportId })), ...(await FastagWalletTxn.distinct("period", { transportId: scope.transportId }))])].filter(Boolean).sort().reverse();

  // tolls by truck
  const byTruck = {};
  const T = (v) => (byTruck[v] = byTruck[v] || { vehicleNo: v, toll: 0, tollCount: 0, walletRecharge: 0 });
  tolls.forEach((t) => { const r = T(t.vehicleNo || "—"); r.toll += t.amount; r.tollCount++; });

  // wallet aggregates
  const wsum = (cat) => wallet.filter((w) => w.category === cat).reduce((s, w) => s + w.amount, 0);
  const topup = wsum("topup");
  const rechargeDebit = wsum("recharge");
  const rechargeReversal = wsum("recharge_reversal"); // over-recharge credited back
  const refund = wsum("refund");                       // service-fee refunds
  const orderPayments = wsum("orderpayment");
  const serviceFees = wsum("servicefee");
  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

  const totalToll = tolls.reduce((s, t) => s + t.amount, 0);
  // Robust regardless of how BlackBuck's internal cycles net: total money that LEFT the wallet,
  // minus the real tolls, is the non-toll charge.
  const allDebits = rechargeDebit + orderPayments + serviceFees;
  const allCredits = rechargeReversal + refund; // excludes top-ups
  const netOutflow = allDebits - allCredits;
  const extras = Math.max(0, netOutflow - totalToll); // non-toll charges (order/service, net of refunds)
  const fastagCost = netOutflow; // = tolls + extras

  // Individual non-toll charges (order payments + service fees) — each reviewable with its txn id,
  // so the owner can verify and dispute false charges with BlackBuck. Refunds shown for context.
  const charges = wallet.filter((w) => w.category === "orderpayment" || w.category === "servicefee").sort((a, b) => (b.txnDate || 0) - (a.txnDate || 0)).map(toWalletTxn);
  const refunds = wallet.filter((w) => w.category === "refund" || w.category === "recharge_reversal").sort((a, b) => (b.txnDate || 0) - (a.txnDate || 0)).map(toWalletTxn);
  const pending = charges.filter((c) => c.reviewStatus === "pending");
  const disputed = charges.filter((c) => c.reviewStatus === "disputed");
  const pendingAmt = pending.reduce((s, c) => s + c.amount, 0);
  const disputedAmt = disputed.reduce((s, c) => s + c.amount, 0);

  // flags — reconciliation at the wallet level (BlackBuck often leaves recharges untagged, so
  // per-truck wallet sums are unreliable; per-truck TOLLS are the truth and shown as-is).
  const flags = [];
  if (pending.length > 0) {
    const pct = totalToll ? Math.round((pendingAmt / totalToll) * 100) : 0;
    flags.push({ level: pct >= 5 ? "warn" : "info", msg: `${pending.length} non-toll charge(s) totalling ${inr(pendingAmt)} to review${pct ? ` (${pct}% of toll spend)` : ""} — verify each below and dispute false ones with BlackBuck.` });
  }
  if (disputed.length > 0) flags.push({ level: "warn", msg: `${disputed.length} charge(s) (${inr(disputedAmt)}) marked DISPUTED — follow up with BlackBuck.` });
  if (netOutflow < totalToll - 1) flags.push({ level: "info", msg: `Tolls (${inr(totalToll)}) exceed the BOSS wallet outflow (${inr(netOutflow)}) — upload the matching month's BOSS wallet statement so charges reconcile.` });

  // plaza frequency
  const plazas = {};
  tolls.forEach((t) => { const p = (t.plaza || "—").split(" - ")[0]; plazas[p] = plazas[p] || { plaza: p, count: 0, amount: 0 }; plazas[p].count++; plazas[p].amount += t.amount; });
  const topPlazas = Object.values(plazas).sort((a, b) => b.amount - a.amount).slice(0, 8);

  return {
    months,
    totals: { totalToll, topup, rechargeDebit, orderPayments, serviceFees, refund: rechargeReversal + refund, netOutflow, extras, fastagCost, tollCount: tolls.length, pendingCount: pending.length, pendingAmt, disputedAmt },
    byTruck: Object.values(byTruck).sort((a, b) => b.toll - a.toll),
    charges,
    refunds,
    flags,
    topPlazas,
  };
}
