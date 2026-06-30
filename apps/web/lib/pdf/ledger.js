// Parsers for the two ledger documents (tuned to Nayara formats; review form catches misses).
//  - Freight statement: per-load freight earned + RTKM + shortage.
//  - Payment advice (bank): per-invoice gross / TDS / net + negative deduction lines.

export function detectLedgerKind(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("statement of freight")) return "freight";
  if (t.includes("payment advice")) return "payment";
  return "";
}

const num = (s) => parseFloat(String(s || "0").replace(/,/g, "")) || 0;

// Freight statement → { company, transporterCode, reference, period, rows[] }
export function parseFreightStatement(text) {
  const flat = (text || "").replace(/\s+/g, " ").trim();
  const company = /nayara/i.test(flat) ? "nayara" : /bharat|bpcl/i.test(flat) ? "bpcl" : /indian oil|iocl?/i.test(flat) ? "ioc" : "";
  // Values sit in a separate column block, so derive from the reference token "<code>/MM/YYYY/...".
  const refMatch = flat.match(/(\d{5,7})\/(\d{2})\/(\d{4})\/(\S+(?:\s\w+)?)/);
  const transporterCode = refMatch ? refMatch[1] : ((flat.match(/:\s*(\d{5,7})\b/) || [])[1] || "");
  const reference = refMatch ? refMatch[0] : "";
  const per = flat.match(/PERIOD\s+([\d.]+)\s+TO\s+([\d.]+)/i);

  const rows = [];
  let m;

  // Primary: Nayara's columns arrive concatenated with NO spaces (pdf-parse glues them), e.g.
  //   8050729664 19.03.2026 194801920 19875825 H305 50383NA383 3021 UP65JT1407 H305/29.03.2026
  //   = salesInv(10) date deliveryDoc(9) shipment(8) supplyLoc(L+3) cmsCode(5+LL+3) product vehicle LR
  // then a separate value block: sale deliv shortage rtkm rate amount.
  // The cmsCode here matches the master Pump cmsCode (e.g. 50383NA383 → "Tulsi Filling Station").
  // Supply Location is a 4-char code that may start with a LETTER (H305) or be ALL DIGITS (4124),
  // hence [A-Z0-9] for its first char — an [A-Z]-only match silently dropped digit-coded statements,
  // losing their freight rate/amount (they parsed as 0 rows → ₹0 / "—").
  const concat = /(\d{10})(\d{2}\.\d{2}\.\d{4})(\d{9})(\d{8})([A-Z0-9]\d{3})(\d{5}[A-Z]{2}\d{3})(\d+)([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4})[\s\S]*?(\d+\.\d{3})\s+(\d+\.\d{3})\s+(\d+\.\d{3})\s+(\d+)\s+(\d+\.\d{2,6})\s+([\d,]+\.\d{2})/g;
  while ((m = concat.exec(flat))) {
    rows.push({
      salesInvNo: m[1], invoiceDate: m[2], deliveryDoc: m[3], shipmentNo: m[4],
      supplyLocation: m[5], customerCode: m[6], product: m[7], vehicle: m[8],
      saleQtyKL: num(m[9]), deliveryQtyKL: num(m[10]), shortageKL: num(m[11]),
      rtkm: parseInt(m[12], 10), freightRate: num(m[13]), freightAmount: num(m[14]),
    });
  }

  // Strict: same columns but space-separated (older/clean exports).
  const strict = /(\d{10})\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{9})\s+(\d{8})\s+(\S+)\s+(\S+)\s+(\d{3,4})\s+(\S+)[\s\S]*?(\d{1,3}\.\d{2,3})\s+(\d{1,3}\.\d{2,3})\s+(\d+\.\d{2,3})\s+(\d{1,4})\s+(\d+\.\d{2,6})\s+([\d,]+\.\d{2})/g;
  if (!rows.length) while ((m = strict.exec(flat))) {
    rows.push({
      salesInvNo: m[1], invoiceDate: m[2], deliveryDoc: m[3], shipmentNo: m[4],
      supplyLocation: m[5], customerCode: m[6], product: m[7], vehicle: m[8],
      saleQtyKL: num(m[9]), deliveryQtyKL: num(m[10]), shortageKL: num(m[11]),
      rtkm: parseInt(m[12], 10), freightRate: num(m[13]), freightAmount: num(m[14]),
    });
  }

  // Loose fallback: anchor on the 10-digit invoice + the trailing numeric group, capturing
  // shipment (8-digit) and customer code when present. Tolerates different column spacing/order.
  if (!rows.length) {
    const loose = /(\d{10})\b(?:[^\n]*?\b(\d{8})\b)?(?:[^\n]*?\b(\d{3,}[A-Z]{2}\d{2,})\b)?[\s\S]{0,200}?(\d{1,3}\.\d{2,3})\s+(\d{1,3}\.\d{2,3})\s+(\d+\.\d{2,3})\s+(\d{1,4})\s+(\d+\.\d{2,6})\s+([\d,]+\.\d{2})/g;
    while ((m = loose.exec(flat))) {
      rows.push({
        salesInvNo: m[1], invoiceDate: "", deliveryDoc: "", shipmentNo: m[2] || "",
        supplyLocation: "", customerCode: m[3] || "", product: "", vehicle: "",
        saleQtyKL: num(m[4]), deliveryQtyKL: num(m[5]), shortageKL: num(m[6]),
        rtkm: parseInt(m[7], 10), freightRate: num(m[8]), freightAmount: num(m[9]),
      });
    }
  }

  return { kind: "freight", company, transporterCode, reference, period: per ? { from: per[1], to: per[2] } : null, rows };
}

// Payment advice → { company, paymentDocNo, utr, valueDate, total, lines[] }
// Handles BOTH spaced and fully-concatenated column layouts. Real Nayara/ICICI extraction
// has no spaces, e.g. "001984391131/03/2026001984391113780.00138.0013642.00".
// The 3 trailing amounts are Gross, TDS, Net (Amount); Net = Gross − TDS (Net=Gross on debit lines).
export function parsePaymentAdvice(text) {
  const t = text || "";
  const company = /nayara/i.test(t) ? "nayara" : "";
  const paymentDocNo = (t.match(/Payment Document No\.?\s*:?\s*(\w+)/i) || [])[1] || "";
  const utr = (t.match(/UTR No\.?\s*:?\s*(\w+)/i) || [])[1] || "";
  const valueDate = (t.match(/Value Date\s*:?\s*([0-9A-Za-z-]+)/i) || [])[1] || "";
  const total = num((t.match(/Check Total\s*:?\s*([\d,]+\.\d{2})/i) || [])[1]);

  // 3 consecutive decimals at end of line (gross merges with invoice number on the left).
  const AMT = /(\d[\d,]*)\.(\d{2})(-?)\s*(\d+)\.(\d{2})(-?)\s*(\d+)\.(\d{2})(-?)\s*$/;
  const sign = (s) => (s === "-" ? -1 : 1);

  const lines = [];
  for (const raw of t.split(/\r?\n/)) {
    const line = raw.trim();
    const dm = line.match(/\d{2}\/\d{2}\/\d{4}/);
    if (!dm) continue;
    const date = dm[0];
    const ref = (line.slice(0, dm.index).match(/(\d{5,})\s*$/) || [])[1];
    if (!ref) continue;
    const tail = line.slice(dm.index + date.length);
    const a = tail.match(AMT);
    if (!a) continue;

    const tds = num(`${a[4]}.${a[5]}`) * sign(a[6]);
    const net = num(`${a[7]}.${a[8]}`) * sign(a[9]);
    const negLine = a[9] === "-";
    const gross = negLine ? net : Math.round((net + tds) * 100) / 100;

    // invoice number: clean digit-run before the amounts (spaced layout),
    // else the merged "invno+grossInt" minus the gross integer length (concatenated layout).
    const before = tail.slice(0, a.index);
    const grossIntLen = String(Math.abs(Math.trunc(gross)) || "").length || 1;
    const mergedInt = a[1].replace(/,/g, "");
    const invoiceNumber = (before.match(/(\d{5,})\s*$/) || [])[1]
      || mergedInt.slice(0, Math.max(0, mergedInt.length - grossIntLen))
      || ref;

    lines.push({ ref, date, invoiceNumber, gross, tds, net });
  }
  return { kind: "payment", company, paymentDocNo, utr, valueDate, total, lines };
}
