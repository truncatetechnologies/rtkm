// Map the three differently-shaped source JSON records into one unified Pump shape.
// Source files use spaced keys like "CMS Code", "RO Name", "RTKM".

function toStr(v) {
  return v == null ? "" : String(v).trim();
}

function toNum(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

// Normalize a single raw record for a given depot slug.
function normalizeRecord(raw, depot) {
  return {
    depot,
    cmsCode: toStr(raw["CMS Code"]),
    roName: toStr(raw["RO Name"]),
    rtkm: toNum(raw["RTKM"]),
    address: toStr(raw["Address"]) || "",
    city: toStr(raw["City"]) || "",
    state: toStr(raw["State"]) || "",
    district: toStr(raw["District"]) || "",
    division: toStr(raw["Division"]) || "",
    zone: toStr(raw["Zone"]) || "",
    sourceLocation: toStr(raw["Source Location"]) || "",
    supplyLocationCode: toStr(raw["Supply Location Code"]) || "",
    lat: null,
    lng: null,
    geocoded: false,
  };
}

// Normalize an array of raw records.
function normalizeAll(rawArray, depot) {
  return (rawArray || [])
    .map((r) => normalizeRecord(r, depot))
    .filter((r) => r.cmsCode && r.roName);
}

module.exports = { normalizeRecord, normalizeAll };
