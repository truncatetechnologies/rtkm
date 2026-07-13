import { dbConnect } from "@/lib/mongoose";
import { createNotification } from "@/lib/services/notifications";

// ---------------------------------------------------------------------------
// VAHAN / Parivahan RC sync.
//
// There is NO free official public API. Data comes from an authorised RC-verification
// provider (Surepass, Cashfree, Gridlines, Eko, …) — paid per lookup, most give trial
// credits. This module is provider-agnostic; pick one with env vars:
//
//   VAHAN_PROVIDER = mock | surepass | generic          (default: mock)
//   VAHAN_API_URL  = https://…/rc                        (surepass/generic)
//   VAHAN_API_TOKEN or VAHAN_API_KEY = <your key>        (bearer / x-api-key)
//   VAHAN_RESULT_PATH = data                             (generic: where the record sits)
//
// `mock` returns deterministic demo data so the whole UI works with zero setup.
// ---------------------------------------------------------------------------

const DOC_LABELS = {
  insuranceUpto: "Insurance",
  fitnessUpto: "Fitness / RC",
  puccUpto: "Pollution (PUCC)",
  permitUpto: "Permit",
  taxUpto: "Road tax",
};
export const DOC_KEYS = Object.keys(DOC_LABELS);

// Days until expiry → status bucket. Shared by UI + notifications.
export function docStatus(expiry, soonDays = 30) {
  if (!expiry) return { key: "unknown", tone: "gray", daysLeft: null };
  const d = new Date(expiry);
  if (isNaN(d)) return { key: "unknown", tone: "gray", daysLeft: null };
  const daysLeft = Math.round((d.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return { key: "expired", tone: "rose", daysLeft };
  if (daysLeft <= soonDays) return { key: "soon", tone: "amber", daysLeft };
  return { key: "ok", tone: "green", daysLeft };
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Parse the many date shapes VAHAN providers return: DD-MMM-YYYY, DD-MM-YYYY, DD/MM/YYYY, ISO.
function parseVahanDate(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s) ? null : s;
  const str = String(s).trim();
  if (!str || /^(na|n\/a|null|-)$/i.test(str)) return null;
  let m = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})$/); // 15-Mar-2026
  if (m) return new Date(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()] ?? 0, +m[1], 12));
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/); // 15-03-2026 / 15/03/26
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(Date.UTC(y, +m[2] - 1, +m[1], 12)); }
  const iso = new Date(str); // ISO / YYYY-MM-DD
  return isNaN(iso) ? null : iso;
}

// Pick the first present value across a list of possible field names (providers differ).
function pick(o, keys) {
  for (const k of keys) {
    if (o && o[k] != null && o[k] !== "") return o[k];
  }
  return "";
}

// Map any provider payload onto our RC shape. Defensive — tolerates missing fields.
export function normalizeRc(raw) {
  const o = raw || {};
  const maker = pick(o, ["maker_description", "vehicle_manufacturer_name", "maker", "manufacturer"]);
  const model = pick(o, ["maker_model", "model", "vehicle_model", "model_name"]);
  return {
    regNo: String(pick(o, ["rc_number", "registration_number", "regn_no", "regNo", "vehicle_number"])).toUpperCase(),
    ownerName: pick(o, ["owner_name", "owner", "ownerName"]),
    makerModel: [maker, model].filter(Boolean).join(" ").trim(),
    vehicleClass: pick(o, ["vehicle_category_description", "vehicle_class_desc", "vehicle_category", "class", "vehicleClass"]),
    fuel: pick(o, ["fuel_type", "fuel", "fuel_descr"]),
    regDate: parseVahanDate(pick(o, ["registration_date", "reg_date", "regn_dt"])),
    chassis: pick(o, ["vehicle_chasi_number", "chassis_number", "chassis", "chasi_no"]),
    engine: pick(o, ["vehicle_engine_number", "engine_number", "engine", "eng_no"]),
    financer: pick(o, ["financer", "financier", "financer_name"]),
    rcStatus: pick(o, ["rc_status", "status", "vehicle_status"]),
    insurer: pick(o, ["insurance_company", "vehicle_insurance_company_name", "insurer", "insurance_company_name"]),
    insurancePolicyNo: pick(o, ["insurance_policy_number", "policy_number", "vehicle_insurance_policy_number"]),
    insuranceUpto: parseVahanDate(pick(o, ["insurance_upto", "vehicle_insurance_upto", "insurance_expiry", "insurance_validity"])),
    fitnessUpto: parseVahanDate(pick(o, ["fitness_upto", "vehicle_fitness_upto", "fit_up_to", "rc_expiry_date", "fitness_expiry"])),
    puccNo: pick(o, ["pucc_number", "puc_number", "pollution_certificate_number"]),
    puccUpto: parseVahanDate(pick(o, ["pucc_upto", "puc_valid_upto", "pollution_upto", "pucc_expiry", "puc_expiry"])),
    permitNo: pick(o, ["permit_number", "permit_no"]),
    permitType: pick(o, ["permit_type", "permit_category"]),
    permitUpto: parseVahanDate(pick(o, ["permit_upto", "permit_valid_upto", "permit_valid_to", "permit_expiry"])),
    taxUpto: parseVahanDate(pick(o, ["tax_upto", "vehicle_tax_upto", "tax_paid_upto", "tax_validity"])),
    raw: o,
  };
}

// ---- providers -----------------------------------------------------------

// Deterministic demo record so the UI is fully usable without a paid key.
function mockRc(regNo) {
  let h = 0;
  for (const c of String(regNo)) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  const rnd = (n) => Math.abs((h = (h * 1103515245 + 12345) & 0x7fffffff)) % n;
  const future = (min, max) => new Date(Date.now() + (min + rnd(max - min)) * 86400000).toISOString();
  return {
    rc_number: regNo,
    owner_name: "DEMO TRANSPORT (SAMPLE DATA)",
    maker_description: "TATA MOTORS LTD",
    maker_model: "LPT 3118",
    vehicle_category_description: "Goods Carrier (Tanker)",
    fuel_type: "DIESEL",
    registration_date: "12-06-2019",
    vehicle_chasi_number: "MAT" + (100000 + rnd(899999)),
    vehicle_engine_number: "ENG" + (100000 + rnd(899999)),
    financer: rnd(2) ? "HDFC BANK LTD" : "",
    rc_status: "ACTIVE",
    insurance_company: "ICICI LOMBARD GENERAL INSURANCE",
    insurance_policy_number: "POL" + (1000000 + rnd(8999999)),
    insurance_upto: future(-40, 300),   // some expired, some valid
    fitness_upto: future(-20, 400),
    pucc_number: "PUC" + (10000 + rnd(89999)),
    pucc_upto: future(-30, 120),        // pollution often near expiry
    permit_number: "PERM" + (10000 + rnd(89999)),
    permit_type: "National Permit",
    permit_upto: future(10, 500),
    tax_upto: future(-10, 365),
  };
}

async function surepassRc(regNo) {
  const url = process.env.VAHAN_API_URL || "https://kyc-api.surepass.io/api/v1/rc/rc-full";
  const token = process.env.VAHAN_API_TOKEN || process.env.VAHAN_API_KEY;
  if (!token) throw new Error("VAHAN_API_TOKEN not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id_number: regNo }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Provider error ${res.status}`);
  return json?.data || json;
}

// Configurable provider: POSTs { registration_number } and reads VAHAN_RESULT_PATH from the response.
async function genericRc(regNo) {
  const url = process.env.VAHAN_API_URL;
  if (!url) throw new Error("VAHAN_API_URL not set");
  const token = process.env.VAHAN_API_TOKEN || process.env.VAHAN_API_KEY;
  const headers = { "Content-Type": "application/json" };
  if (token) { headers.Authorization = `Bearer ${token}`; headers["x-api-key"] = token; }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ registration_number: regNo, rc_number: regNo, id_number: regNo }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `Provider error ${res.status}`);
  const path = process.env.VAHAN_RESULT_PATH || "data";
  return path.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : acc), json);
}

export function vahanProvider() {
  return (process.env.VAHAN_PROVIDER || "mock").toLowerCase();
}

// Fetch + normalise one vehicle's record. Returns { rc, raw }.
export async function fetchVahan(regNo) {
  const clean = String(regNo || "").replace(/\s/g, "").toUpperCase();
  if (!clean) throw new Error("No registration number");
  const provider = vahanProvider();
  let raw;
  if (provider === "surepass") raw = await surepassRc(clean);
  else if (provider === "generic") raw = await genericRc(clean);
  else raw = mockRc(clean);
  return { provider, rc: normalizeRc(raw) };
}

// Sync one Truck doc against VAHAN, persist, and notify on expired/expiring documents.
export async function syncTruckVahan(truck, scope) {
  await dbConnect();
  if (!truck.registrationNo) throw new Error("Truck has no registration number");
  let rc;
  try {
    const out = await fetchVahan(truck.registrationNo);
    rc = { ...out.rc, provider: out.provider, status: "ok", error: "", fetchedAt: new Date() };
  } catch (e) {
    truck.rc = { ...(truck.rc?.toObject ? truck.rc.toObject() : truck.rc || {}), status: "error", error: String(e.message || e), fetchedAt: new Date(), provider: vahanProvider() };
    await truck.save();
    throw e;
  }
  truck.rc = rc;
  await truck.save();

  // Notify for anything expired or due within 30 days (deduped per truck+doc+expiry).
  if (scope) {
    for (const key of DOC_KEYS) {
      const st = docStatus(rc[key]);
      if (st.key === "expired" || st.key === "soon") {
        await createNotification({
          ownerId: scope.ownerId, transportId: scope.transportId, type: "alert",
          title: st.key === "expired" ? "Vehicle document expired" : "Vehicle document expiring",
          body: `${truck.registrationNo} — ${DOC_LABELS[key]} ${st.key === "expired" ? "expired" : "expires"} ${fmtDate(rc[key])}`,
          link: "/app/trucks",
          dedupeKey: `vahan:${truck._id}:${key}:${new Date(rc[key]).toISOString().slice(0, 10)}`,
        });
      }
    }
  }
  return truck;
}
