import fs from "fs/promises";
import path from "path";
import { dbConnect } from "@/lib/mongoose";
import { Upload, Pump, Load, RtkmRequest } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { extractText } from "@/lib/pdf/extract";
import { parseInvoice, parseShortage } from "@/lib/pdf/parsers";
import { sha256 } from "@/lib/crypto";
import { notifyAdmins } from "@/lib/services/notifications";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Look up RTKM for a pump code: prefer master pump data, fall back to this transport's prior loads.
export async function lookupRtkm(transportId, cmsCode) {
  const code = String(cmsCode || "").trim();
  if (!code) return null;
  const pump = await Pump.findOne({ cmsCode: code, status: { $ne: "rejected" } }).select("rtkm");
  if (pump?.rtkm) return pump.rtkm;
  const prior = await Load.findOne({ transportId, cmsCode: code, rtkm: { $gt: 0 } }).sort({ createdAt: -1 }).select("rtkm");
  return prior?.rtkm || null;
}

// Build a { cmsCode -> { rtkm, roName } } map for a set of pump codes (one DB round-trip).
// Used to fill in pump name + RTKM on freight-statement rows, which only carry the customer code.
export async function lookupPumps(transportId, codes) {
  const clean = [...new Set((codes || []).map((c) => String(c || "").trim()).filter(Boolean))];
  const out = {};
  if (!clean.length) return out;
  const pumps = await Pump.find({ cmsCode: { $in: clean }, status: { $ne: "rejected" } }).select("cmsCode roName rtkm");
  pumps.forEach((p) => { out[p.cmsCode] = { rtkm: p.rtkm || 0, roName: p.roName || "" }; });
  // Fall back to this transport's prior loads for any code not in master data.
  const missing = clean.filter((c) => !out[c]);
  if (missing.length) {
    const prior = await Load.find({ transportId, cmsCode: { $in: missing } }).sort({ createdAt: -1 }).select("cmsCode roName rtkm");
    prior.forEach((l) => { if (!out[l.cmsCode]) out[l.cmsCode] = { rtkm: l.rtkm || 0, roName: l.roName || "" }; });
  }
  return out;
}

// Keep master pump RTKM in sync with what the PDFs report:
//  - master has no RTKM yet  -> set it (auto-fill).
//  - master RTKM differs     -> raise a pending change request for an admin to approve.
// `rows` = [{ cmsCode, rtkm, invoiceNumber }]. Best-effort; never throws into the caller.
export async function reconcileRtkm({ transportId, ownerId, source, rows }) {
  try {
    const clean = (rows || []).filter((r) => r.cmsCode && Number(r.rtkm) > 0);
    if (!clean.length) return;
    const codes = [...new Set(clean.map((r) => String(r.cmsCode).trim()))];
    const pumps = await Pump.find({ cmsCode: { $in: codes }, status: { $ne: "rejected" } });
    // A cmsCode can exist in several depots with DIFFERENT RTKM — only reconcile codes that map
    // to exactly one master pump, so we never overwrite the wrong depot's value.
    const byCode = new Map();
    pumps.forEach((p) => { const k = p.cmsCode; byCode.set(k, byCode.has(k) ? null : p); });
    const seen = new Set();
    for (const r of clean) {
      const code = String(r.cmsCode).trim();
      if (seen.has(code)) continue; // one decision per pump per upload
      seen.add(code);
      const pump = byCode.get(code);
      if (!pump) continue; // not found, or ambiguous across depots → skip
      const proposed = Math.round(Number(r.rtkm));
      const current = Math.round(pump.rtkm || 0);
      if (!current) {
        pump.rtkm = proposed;
        await pump.save();
      } else if (current !== proposed) {
        const dup = await RtkmRequest.findOne({ pumpId: pump._id, proposedRtkm: proposed, status: "pending" });
        if (!dup) {
          const created = await RtkmRequest.create({
            pumpId: pump._id, cmsCode: code, roName: pump.roName || "",
            currentRtkm: current, proposedRtkm: proposed, source: source || "",
            invoiceNumber: r.invoiceNumber || "", transportId, ownerId, status: "pending",
          });
          // Alert the admin (in-app bell + OS push) — they approve RTKM changes.
          await notifyAdmins({
            type: "approval",
            title: "RTKM approval needed",
            body: `${pump.roName || code} (${code}): ${current} → ${proposed} km`,
            link: "/admin/approvals",
            dedupeKey: `rtkm-${created._id}`,
          });
        }
      }
    }
  } catch { /* best-effort */ }
}

// Save a PDF buffer, extract text, parse it, store an Upload doc. Shared by file upload + Gmail import.
// Returns { upload, parsed, textPreview }.
export async function storeAndParse({ scope, kind, buffer, filename, source = "upload" }) {
  const dir = path.join(UPLOAD_DIR, scope.transportId);
  await fs.mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}-${String(filename || "file.pdf").replace(/[^\w.\-]/g, "_")}`;
  await fs.writeFile(path.join(dir, safeName), buffer);

  const text = await extractText(buffer);
  const parsed = kind === "invoice" ? parseInvoice(text) : parseShortage(text);

  await dbConnect();
  const hash = sha256(buffer);
  const prior = await Upload.findOne({ transportId: scope.transportId, hash }).select("createdAt");

  // Auto-fill RTKM from master pump / old load data so the user doesn't type it.
  if (kind === "invoice" && parsed.fields?.pumpCode && !parsed.fields.rtkm) {
    const rtkm = await lookupRtkm(scope.transportId, parsed.fields.pumpCode);
    if (rtkm) parsed.fields.rtkm = rtkm;
  }

  const upload = await Upload.create({
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    kind,
    company: parsed.company || "",
    hash,
    filename: filename || safeName,
    path: path.join(scope.transportId, safeName),
    parsedJson: parsed.fields,
    status: parsed.confidence === "high" ? "parsed" : "needs_review",
    source,
    uploadedBy: scope.identity.userId,
  });
  return { upload, parsed, textPreview: (text || "").slice(0, 600), duplicate: !!prior, firstSeenAt: prior?.createdAt || null };
}

// Multipart file-upload entry point.
export async function ingestPdf(request, kind) {
  const form = await request.formData();
  const file = form.get("file");
  const transportId = form.get("transportId");

  const scope = await resolveScope(request, { roles: ["owner", "manager", "driver"], transportId });
  if (scope.error) return { error: scope.error };
  if (!file || typeof file === "string") return { errorMsg: "No file uploaded" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const r = await storeAndParse({ scope, kind, buffer, filename: file.name, source: "upload" });
  return { scope, ...r };
}
