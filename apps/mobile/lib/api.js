import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUrl, getToken, getLastSync, setLastSync } from "./config";
import { upsertPumps, countPumps } from "./db";

async function url(path) {
  const base = await getServerUrl();
  return base + path;
}
async function authHeaders() {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Slow-network resilient request:
//  - aborts after `timeout` so weak connections fail fast instead of hanging
//  - caches successful GET responses, and on a network error/timeout falls back to the
//    last cached response so screens still show last-known data offline.
async function req(path, { method = "GET", body, timeout = 15000 } = {}) {
  const isGet = method === "GET";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(await url(path), {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(await authHeaders()) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    if (isGet) AsyncStorage.setItem("cache:" + path, JSON.stringify(data)).catch(() => {});
    return data;
  } catch (e) {
    if (isGet) {
      const cached = await AsyncStorage.getItem("cache:" + path).catch(() => null);
      if (cached != null) { try { return JSON.parse(cached); } catch {} }
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Clear cached GET responses (call on logout so data isn't shown to the next user).
export async function clearApiCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith("cache:"));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}

// ---- Public: sync + driver submission ----
export async function syncFromServer() {
  const since = await getLastSync();
  const res = await fetch(await url(`/api/sync?since=${encodeURIComponent(since)}`));
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  const data = await res.json();
  if (data.pumps?.length) await upsertPumps(data.pumps);
  await setLastSync(data.serverTime);
  return { changed: data.count, total: await countPumps() };
}
export async function submitPump(payload) {
  const res = await fetch(await url("/api/submissions"), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Submit failed");
  return data;
}

// ---- Auth ----
export async function ownerRegister({ name, phone, pin }) {
  return req("/api/auth/owner/register", { method: "POST", body: { name, phone, pin } });
}
export async function login({ phone, pin }) {
  return req("/api/auth/owner/login", { method: "POST", body: { phone, pin } });
}
export async function whoAmI() { return req("/api/auth/owner/me"); }

// ---- Owner/manager fleet ----
export async function getTransports() { return (await req("/api/transports")).transports; }
export async function updateTransport(id, body) { return (await req(`/api/transports/${id}`, { method: "PUT", body })).transport; }
// Owner "fresh start": wipe this transport's transactional data (optionally trucks + members too).
export async function wipeTransport(id, includeFleet) { return req(`/api/transports/${id}/wipe`, { method: "POST", body: { includeFleet }, timeout: 120000 }); }
export async function getMembers(transportId, role) {
  return (await req(`/api/members?transportId=${transportId}${role ? `&role=${role}` : ""}`)).members;
}
export async function createMember(payload) { return (await req("/api/members", { method: "POST", body: payload })).member; }
export async function updateMember(id, payload) { return (await req(`/api/members/${id}`, { method: "PUT", body: payload })).member; }
export async function getTrucks(transportId) { return (await req(`/api/trucks?transportId=${transportId}`)).trucks; }
export async function createTruck(payload) { return (await req("/api/trucks", { method: "POST", body: payload })).truck; }
export async function updateTruck(id, payload) { return (await req(`/api/trucks/${id}`, { method: "PUT", body: payload })).truck; }
export async function getLoads(transportId) { return (await req(`/api/loads?transportId=${transportId}`)).loads; }
export async function getShortages(transportId) { return (await req(`/api/shortages?transportId=${transportId}`)).shortages; }
// Capture shortages early from Nayara delivery-confirmation emails (before the monthly freight PDF).
export async function syncDeliveries(transportId, days) { return req("/api/deliveries/sync", { method: "POST", body: { transportId, days }, timeout: 300000 }); }
export async function getSpend(transportId, from, to, company) {
  let p = `/api/reports/spend?transportId=${transportId}`;
  if (from) p += `&from=${encodeURIComponent(from)}`;
  if (to) p += `&to=${encodeURIComponent(to)}`;
  if (company && company !== "all") p += `&company=${company}`;
  return req(p);
}
export async function getCompanies(transportId) { return (await req(`/api/companies?transportId=${transportId}`)).companies; }

// ---- Maintenance ----
export async function getMaintenance(transportId) { return (await req(`/api/maintenance?transportId=${transportId}`)).maintenance; }
export async function createMaintenance(payload) { return (await req("/api/maintenance", { method: "POST", body: payload })).maintenance; }

// ---- Extra oil (extra diesel given mid-trip) ----
export async function getExtraOil(transportId) { return (await req(`/api/extra-oil?transportId=${transportId}`)).extraOil; }
export async function addExtraOil(payload) { return (await req("/api/extra-oil", { method: "POST", body: payload })).extraOil; }
export async function deleteExtraOil(id) { return req(`/api/extra-oil/${id}`, { method: "DELETE" }); }
export async function getExtraOilReport(transportId, period) { return req(`/api/reports/extra-oil?transportId=${transportId}${period ? `&period=${period}` : ""}`); }

// ---- Salary ----
export async function getSalaries(transportId) { return (await req(`/api/salary?transportId=${transportId}`)).payslips; }
export async function generateSalary(payload) { return (await req("/api/salary/generate", { method: "POST", body: payload })).payslip; }
export async function paySalary(id) { return req(`/api/salary/${id}/pay`, { method: "POST" }); }
export async function discardSalary(id) { return req(`/api/salary/${id}`, { method: "DELETE" }); }

// ---- Driver leaves (pro-rate salary) ----
export async function getLeaves(transportId, driverId) {
  return (await req(`/api/leaves?transportId=${transportId}${driverId ? `&driverId=${driverId}` : ""}`)).leaves;
}
export async function addLeave(payload) { return (await req("/api/leaves", { method: "POST", body: payload })).leave; }
export async function deleteLeave(id) { return req(`/api/leaves/${id}`, { method: "DELETE" }); }

// ---- Ledger / reconciliation ----
export async function getLedger(transportId, company, from, to) {
  let p = `/api/ledger?transportId=${transportId}`;
  if (company && company !== "all") p += `&company=${company}`;
  if (from) p += `&from=${encodeURIComponent(from)}`;
  if (to) p += `&to=${encodeURIComponent(to)}`;
  return req(p);
}
// Mark a delivery's invoice "received offline" so it stops counting as pending.
export async function ackInvoice(transportId, invoiceNumber) { return req("/api/loads/ack-invoice", { method: "POST", body: { transportId, invoiceNumber } }); }
export async function uploadLedger(asset, transportId, force) { return uploadPdf("/api/ledger/upload", asset, transportId, force); }
export async function getDriverShortage(transportId, period) { return req(`/api/reports/driver-shortage?transportId=${transportId}${period ? `&period=${period}` : ""}`); }
export async function getProfitability(transportId) { return req(`/api/reports/profitability?transportId=${transportId}`); }
export async function getFastagReport(transportId, period) { return req(`/api/fastag/report?transportId=${transportId}${period ? `&period=${period}` : ""}`); }
export async function uploadFastag(asset, transportId) { return uploadPdf("/api/fastag/upload", asset, transportId); }
export async function markFastagCharge(id, status, note) { return req(`/api/fastag/charge/${id}`, { method: "POST", body: { status, note } }); }
// ---- Depot Gate In (parsed from oil-company notification emails) ----
export async function getGateIns(transportId) { return req(`/api/gate-in?transportId=${transportId}`); }
export async function syncGateIns(transportId, days) { return req("/api/gate-in/sync", { method: "POST", body: { transportId, days }, timeout: 300000 }); }
export async function getVehicleAlerts(transportId) { return req(`/api/vehicle-alerts?transportId=${transportId}`); }
export async function syncVehicleAlerts(transportId, days) { return req("/api/vehicle-alerts/sync", { method: "POST", body: { transportId, days }, timeout: 300000 }); }

// ---- Uploads history / undo ----
export async function getUploads(transportId) { return (await req(`/api/uploads?transportId=${transportId}`)).uploads; }
export async function revertUpload(id) { return req(`/api/uploads/${id}/revert`, { method: "POST" }); }

// ---- Gmail import (connect happens on web; mobile scans + imports a connected inbox) ----
export async function gmailStatus(transportId) { return (await req(`/api/integrations/gmail/status?transportId=${transportId}`)).gmail; }
export async function gmailMessages(transportId) { return (await req(`/api/integrations/gmail/messages?transportId=${transportId}`)).messages; }
export async function gmailImport(payload) { return req("/api/integrations/gmail/import", { method: "POST", body: payload }); }
// Bulk: scan inbox and auto-file every statement (uses saved sender domains). Long-running.
export async function gmailImportAll(transportId, senders, days) {
  return req("/api/integrations/gmail/import-all", { method: "POST", body: { transportId, senders, days, save: !!(senders && senders.length) }, timeout: 600000 });
}

// ---- Notifications ----
export async function getNotifications(transportId) { return req(`/api/notifications?transportId=${transportId}`); }
export async function markNotificationsRead(transportId, ids) { return req("/api/notifications/read", { method: "POST", body: { transportId, ids } }); }
export async function checkNotifications(transportId) { return req("/api/notifications/check", { method: "POST", body: { transportId } }); }
export async function registerPush(transportId, token) { return req("/api/push/register", { method: "POST", body: { transportId, platform: "expo", token } }); }

// ---- Admin (view-only oversight + RTKM approvals) ----
export async function registerAdminPush(token) { return req("/api/push/register", { method: "POST", body: { platform: "expo", token } }); }
export async function getAdminTransports() { return (await req("/api/admin/transports")).transports; }
export async function getAdminTransport(id, period) { return req(`/api/admin/transports/${id}${period ? `?period=${period}` : ""}`); }
export async function getRtkmRequests(status = "pending") { return req(`/api/admin/rtkm-requests?status=${status}`); }
export async function decideRtkmRequest(id, action) { return req(`/api/admin/rtkm-requests/${id}`, { method: "POST", body: { action } }); }
export async function getAdminNotifications() { return req("/api/admin/notifications"); }
export async function markAdminNotificationsRead(ids) { return req("/api/admin/notifications", { method: "POST", body: { ids } }); }

// ---- Driver self ----
export async function getMyLoads() { return (await req("/api/me/loads")).loads; }
export async function getMyPayslips() { return req("/api/me/payslips"); }
export async function getMyMeterReadings() { return (await req("/api/me/meter-readings")).readings; }

// ---- Meter readings ----
export async function getMeterReadings(transportId) { return (await req(`/api/meter-readings?transportId=${transportId}`)).readings; }
// Submit a meter reading with an optional photo (image-picker asset { uri, fileName, mimeType }).
// `path` is the driver self route or the owner route; `fields` are text fields.
async function uploadMeterReading(path, fields, asset) {
  const fd = new FormData();
  Object.entries(fields || {}).forEach(([k, v]) => { if (v != null && v !== "") fd.append(k, String(v)); });
  if (asset?.uri) fd.append("photo", { uri: asset.uri, name: asset.fileName || "meter.jpg", type: asset.mimeType || "image/jpeg" });
  const res = await fetch(await url(path), { method: "POST", headers: { ...(await authHeaders()) }, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}
export async function submitMyMeterReading(fields, asset) { return uploadMeterReading("/api/me/meter-readings", fields, asset); }
export async function submitMeterReading(fields, asset) { return uploadMeterReading("/api/meter-readings", fields, asset); }

// ---- PDF upload (expo-document-picker asset: { uri, name, mimeType }) ----
async function uploadPdf(path, asset, transportId, force) {
  const fd = new FormData();
  fd.append("file", { uri: asset.uri, name: asset.name || "upload.pdf", type: asset.mimeType || "application/pdf" });
  if (transportId) fd.append("transportId", transportId);
  if (force) fd.append("force", "true");
  const res = await fetch(await url(path), { method: "POST", headers: { ...(await authHeaders()) }, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}
export async function uploadInvoice(asset, transportId) { return uploadPdf("/api/uploads/invoice", asset, transportId); }
export async function uploadShortage(asset, transportId) { return uploadPdf("/api/uploads/shortage", asset, transportId); }
// Returns the full response ({ load, shipment, duplicate }) — the shipment summary drives the
// "diesel for this trip" acknowledgement shown after an invoice is saved.
export async function confirmInvoice(payload) { return req("/api/loads/from-invoice", { method: "POST", body: payload }); }
export async function setMealAllowance(loadId, amount) { return req(`/api/loads/${loadId}/meal-allowance`, { method: "POST", body: { amount } }); }
export async function confirmShortage(payload) { return req("/api/shortages/from-pdf", { method: "POST", body: payload }); }
