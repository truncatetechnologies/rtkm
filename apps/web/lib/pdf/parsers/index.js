// Heuristic, company-aware extraction from oil-company PDF text.
// These are best-effort patterns; the UI always shows a review/edit form before saving.
// When the user shares real sample PDFs, tighten the per-company regexes below.

export function detectCompany(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("nayara")) return "nayara";
  if (t.includes("bharat petroleum") || /\bbpcl\b/.test(t)) return "bpcl";
  if (t.includes("indian oil") || /\biocl?\b/.test(t)) return "ioc";
  if (t.includes("hindustan petroleum") || /\bhpcl\b/.test(t)) return "hpcl";
  return "";
}

function first(re, text, group = 1) {
  const m = (text || "").match(re);
  return m ? (m[group] || "").trim() : "";
}

function num(s) {
  const n = parseFloat(String(s).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
}

// Parse an invoice/dispatch PDF -> load draft fields.
export function parseInvoice(text) {
  const company = detectCompany(text);

  // ---- Precise parser for the Nayara TAX INVOICE format ----
  const flat = (text || "").replace(/\s+/g, " ").trim();
  if (/TAX INVOICE/i.test(flat) && /nayara/i.test(flat)) {
    const g = (re, gr = 1) => { const m = flat.match(re); return m ? (m[gr] || "").trim() : ""; };
    const cust = flat.match(/Name and Address of Customer\s+(.+?)\s*,\s*\(([A-Z0-9]+)\)\s*(.+?)\s*VAT TIN/i);
    const qtyKL = num(g(/Qty\s*([\d.]+)\s*KL/i));
    const volL = num(g(/Volume\(N\)\s*:?\s*([\d.]+)/i));
    const fields = {
      company: "nayara",
      invoiceNumber: g(/Invoice Number\s*:?\s*(\d+)/i),
      invoiceDate: g(/Invoice Date(?: and Time)?\s*:?\s*([\d.]{8,10}(?:\s+[\d:]+)?)/i),
      roName: cust ? cust[1].trim() : "",
      pumpCode: cust ? cust[2].trim() : g(/\(([0-9]{4,}[A-Z]{2}[0-9]{2,})\)/),
      address: cust ? cust[3].replace(/\s+/g, " ").trim() : "",
      product: g(/Product Code\s*:?\s*(\d+)/i),
      loadQtyL: volL || Math.round(qtyKL * 1000),
      truckReg: g(/Vehicle No\s*:?\s*([A-Z0-9]+)/i),
      shipmentNo: g(/Shipment No\s*:?\s*(\d+)/i),
      lrNumber: g(/LR No\s*:?\s*(\S+)/i),
      supplyLocation: g(/\((H\d{3})\)/),
      fromLocation: "NAYARA ENERGY LIMITED",
      driverName: g(/Driver Name:\s*([A-Z][A-Z .]+?)\s*Lic No/i),
    };
    fields.toLocation = fields.roName;
    const known = [fields.invoiceNumber, fields.pumpCode, fields.loadQtyL].filter(Boolean).length;
    return { kind: "invoice", company: "nayara", fields, confidence: known >= 2 ? "high" : "low" };
  }

  // ---- Generic fallback ----
  const invoiceNumber = first(/invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/i, text);
  const invoiceDate = first(/(?:invoice\s*)?date\s*[:\-]?\s*([0-3]?\d[\/\-.][01]?\d[\/\-.]\d{2,4})/i, text);
  const pumpCode = first(/(?:ro\s*code|pump\s*code|cms\s*code|customer\s*code)\s*[:\-]?\s*([A-Z0-9]{3,})/i, text);
  const product = first(/\b(HSD|MS|HIGH SPEED DIESEL|MOTOR SPIRIT|PETROL|DIESEL|XP95|SPEED)\b/i, text);
  const loadQtyL = num(first(/(?:quantity|qty|volume|net\s*qty)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*(?:l|ltr|litre|liters|kl)?/i, text));
  const fromLocation = first(/(?:from|despatch(?:ed)?\s*from|source|terminal|depot)\s*[:\-]?\s*([A-Za-z0-9 ,.\-]{3,40})/i, text);
  const toLocation = first(/(?:to|delivery\s*to|destination|ship\s*to|customer\s*name)\s*[:\-]?\s*([A-Za-z0-9 ,.\-]{3,40})/i, text);
  const truckReg = first(/(?:vehicle|truck|tanker|lorry|tt)\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{3,4})/i, text);

  const fields = { company, invoiceNumber, invoiceDate, pumpCode, product, loadQtyL, fromLocation, toLocation, truckReg };
  const known = [invoiceNumber, pumpCode, loadQtyL].filter(Boolean).length;
  return { kind: "invoice", company, fields, confidence: known >= 2 ? "high" : known === 1 ? "low" : "none" };
}

// Parse a shortage report PDF -> shortage draft fields (must include invoice number to map).
export function parseShortage(text) {
  const company = detectCompany(text);
  const invoiceNumber = first(/(?:against\s*)?invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/i, text);
  const shortageL = num(first(/(?:shortage|short|loss|difference|variation)\s*(?:qty|quantity|in\s*ltr|ltr|litre|liters)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i, text));
  const dispatchedL = num(first(/(?:despatch(?:ed)?|loaded|invoice)\s*(?:qty|quantity)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i, text));
  const receivedL = num(first(/(?:received|delivered|dip\s*qty)\s*(?:qty|quantity)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i, text));

  const fields = { company, invoiceNumber, shortageL: shortageL || Math.max(0, dispatchedL - receivedL), dispatchedL, receivedL };
  return { kind: "shortage", company, fields, confidence: invoiceNumber && fields.shortageL ? "high" : invoiceNumber ? "low" : "none" };
}
