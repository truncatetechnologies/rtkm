"use client";
// Client-side API helper for the /app dashboard. Owner web auth uses the httpOnly cookie,
// so same-origin fetches just work. The active transport is remembered in localStorage.

// Fetch with an abort timeout so slow connections fail fast instead of hanging,
// and a single retry for idempotent GETs that time out / drop (common on weak networks).
export async function api(path, { method = "GET", body, timeout = 20000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const err = new Error(data.error || `Request failed (${res.status})`); err.status = res.status; throw err; }
      return data;
    } catch (e) {
      lastErr = e;
      const network = e.name === "AbortError" || e.name === "TypeError"; // timeout or no connection
      if (method === "GET" && network && attempt < retries) continue; // retry idempotent reads only
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

export async function uploadPdf(path, file, transportId, force = false) {
  const fd = new FormData();
  fd.append("file", file);
  if (transportId) fd.append("transportId", transportId);
  if (force) fd.append("force", "true");
  const res = await fetch(path, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

// Submit a meter reading (count + optional photo) as multipart. `fields` is a plain object
// of text fields, `photo` is a File (or null).
export async function uploadMeterReading(path, { fields = {}, photo } = {}) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v != null) fd.append(k, String(v)); });
  if (photo) fd.append("photo", photo);
  const res = await fetch(path, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

export function getActiveTransport() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rtkm-active-transport");
}
export function setActiveTransport(id) {
  localStorage.setItem("rtkm-active-transport", id);
}

export const COMPANIES = ["nayara", "bpcl", "ioc", "hpcl"];
export const COMPANY_LABELS = { nayara: "Nayara", bpcl: "BPCL", ioc: "IOC", hpcl: "HPCL" };
export const companyLabel = (c) => COMPANY_LABELS[c] || (c ? c.toUpperCase() : "All companies");

export function getActiveCompany() {
  if (typeof window === "undefined") return "all";
  return localStorage.getItem("rtkm-active-company") || "all";
}
export function setActiveCompany(c) {
  localStorage.setItem("rtkm-active-company", c || "all");
}
