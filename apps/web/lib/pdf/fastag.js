// Parsers for BlackBuck FASTag statements:
//  - BOSS wallet summary (one per month, all trucks): top-ups + recharges + fees.
//  - Per-tanker (IDFC) summary (one per truck): the real tolls, with plaza.
// Amount + closing balance are glued in the PDF text (e.g. "Debit6603,937"); we split them
// using the running-balance chain (closing_i = closing_{i-1} ± amount_i), rejecting leading-zero
// splits which balances/amounts never have.

const num = (s) => parseFloat(String(s).replace(/,/g, "")) || 0;
const isNumStr = (s) => /^-?([1-9]\d{0,2}(,\d{3})*|[1-9]\d*|0)$/.test(s);

function splitChain(rows) {
  const cands = rows.map((r) => {
    const out = [];
    for (let i = 1; i < r.blob.length; i++) {
      const a = r.blob.slice(0, i), c = r.blob.slice(i);
      if (isNumStr(a) && isNumStr(c)) out.push({ amt: num(a), close: num(c) });
    }
    if (!out.length) out.push({ amt: 0, close: 0 });
    return out;
  });
  let best = null;
  for (const seed of cands[0]) {
    const chosen = [seed]; let ok = 0;
    for (let i = 1; i < rows.length; i++) {
      const prev = chosen[i - 1].close;
      const pick = cands[i].find((s) => Math.abs((prev + rows[i].sign * s.amt) - s.close) < 0.5);
      chosen.push(pick || cands[i][0]); if (pick) ok++;
    }
    if (!best || ok > best.ok) best = { ok, chosen };
  }
  return best.chosen;
}

const reg = (s) => (/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{3,4}$/.test(String(s || "").replace(/\s/g, "").toUpperCase()) ? String(s).replace(/\s/g, "").toUpperCase() : "");

// Detect which BlackBuck statement this is.
export function detectFastagKind(text) {
  const t = (text || "");
  if (/BOSS ACCOUNT SUMMARY/i.test(t)) return "boss";
  if (/FASTAG ACCOUNT SUMMARY/i.test(t) && /Truck Number/i.test(t)) return "tag";
  return "";
}

// Per-tanker (IDFC) statement → { truck, period, statedCredit, statedDebit, rows[] }
// rows: { type:"toll"|"recharge", amount, closing, plaza, txnId, date }
export function parseFastagTag(text) {
  const L = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const truck = reg((L.find((l) => l.startsWith("Truck Number")) || "").split(":").pop());
  const period = (L.find((l) => l.startsWith("Statement Duration")) || "").split(":").slice(1).join(":").trim();
  const rows = [];
  const dates = [];
  for (let i = 0; i < L.length; i++) {
    const dm = L[i].match(/^(\d{1,2} \w{3} \d{2})$/);
    if (dm) dates.push(dm[1]);
    const m = L[i].match(/^(Debit|Credit)([\d,.-]+)(.*)$/);
    if (!m || !/^[\d,.-]+$/.test(m[2])) continue;
    const sign = m[1] === "Credit" ? 1 : -1;
    const date = dates[dates.length - 1] || "";
    if (/FasTag Recharge/i.test(m[3])) {
      const mm = m[3].match(/FasTag Recharge([0-9a-f]+)\s*([0-9a-f]*)$/i);
      rows.push({ sign, blob: m[2], type: "recharge", plaza: "", txnId: mm ? (mm[1] + (mm[2] || "")) : "", date });
    } else {
      let j = i + 1; const parts = [];
      while (j < L.length && !/^\d{6,}$/.test(L[j]) && !/^\d{1,2} \w{3} \d{2}$/.test(L[j])) { parts.push(L[j]); j++; }
      rows.push({ sign, blob: m[2], type: "toll", plaza: parts.join(" ").replace(/^Toll Payment at /i, "").trim(), txnId: (L[j] && /^[0-9a-zA-Z]+$/.test(L[j])) ? L[j] : "", date });
    }
  }
  const split = splitChain(rows);
  rows.forEach((r, i) => { r.amount = split[i].amt; r.closing = split[i].close; });
  const stated = (L[L.indexOf(L.find((l) => /Credit \(Recharge\)/i.test(l))) + 1] || "").match(/([\d,]+)([\d,]+)?/);
  return { truck, period, rows };
}

// BOSS wallet statement → { customer, mobile, period, rows[] }
// rows: { sign, desc, amount, closing, truck, txnId, date }
const BOSS_DESCS = "FasTag Recharge|FASTag Order Payment|Service Fee Refund|Service fee for|Top-Up|Top Up";
export function parseBossWallet(text) {
  const L = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const period = (L.find((l) => l.startsWith("Statement Duration")) || "").split(":").slice(1).join(":").trim();
  const rows = [];
  const dates = [];
  for (const line of L) {
    const dm = line.match(/^(\d{1,2} \w{3} \d{2})$/);
    if (dm) { dates.push(dm[1]); continue; }
    const m = line.match(new RegExp(`^(Debit|Credit)([\\d,.-]+)(${BOSS_DESCS})(.*)$`));
    if (!m) continue;
    const rest = m[4];
    const mm = rest.match(/^(.*?)(\d{10})$/); // BOSS txn ids are 10 digits
    rows.push({ sign: m[1] === "Credit" ? 1 : -1, blob: m[2], desc: m[3].replace(/Top Up/i, "Top-Up"), truck: reg(mm ? mm[1] : ""), txnId: mm ? mm[2] : "", date: dates[dates.length - 1] || "" });
  }
  const split = splitChain(rows);
  rows.forEach((r, i) => { r.amount = split[i].amt; r.closing = split[i].close; });
  return { period, rows };
}
