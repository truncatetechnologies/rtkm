"use client";
import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import MuiIconButton from "@mui/material/IconButton";
import { UploadCloud, FileText, CheckCircle2, X, Sparkles, AlertTriangle, Fuel } from "@/components/icons";
import { useApp } from "@/lib/appContext";
import { uploadPdf, api } from "@/lib/clientApi";
import { Button, Input, rupee } from "@/components/ui";
import UploadValidation from "@/components/UploadValidation";

// Acknowledgement shown right after an invoice is filed: the whole shipment's total vs longest (farthest)
// RTKM and the diesel the driver should get for the trip. The oil price is editable here and, when saved,
// becomes the global diesel price used across every load, the ledger and all reports.
function InvoiceAck({ shipment, activeId }) {
  const [price, setPrice] = useState(String(shipment?.dieselPrice ?? 0));
  const [baseline, setBaseline] = useState(Number(shipment?.dieselPrice) || 0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meal, setMeal] = useState(String(shipment?.mealAllowance ?? 0));
  const [mealBase, setMealBase] = useState(Number(shipment?.mealAllowance) || 0);
  const [mealBusy, setMealBusy] = useState(false);
  if (!shipment) return null;
  const p = Number(price) || 0;
  const liters = shipment.dieselLiters || 0;
  const amount = Math.round(liters * p);
  const dirty = p !== baseline;
  const mealVal = Number(meal) || 0;
  const mealDirty = mealVal !== mealBase;
  const giveTotal = amount + mealVal;

  async function savePrice() {
    if (!activeId) return;
    setBusy(true);
    try {
      await api(`/api/transports/${activeId}`, { method: "PUT", body: { dieselPrice: p } });
      setBaseline(p); // "dirty" resets; the new price is now the global baseline
      setSaved(true);
    } catch { /* surfaced by the disabled state; keep the card usable */ }
    finally { setBusy(false); }
  }

  // Meal allowance is per-trip: save pins this trip's value (the default lives in Settings).
  async function saveMeal() {
    if (!shipment.loadId) return;
    setMealBusy(true);
    try {
      await api(`/api/loads/${shipment.loadId}/meal-allowance`, { method: "POST", body: { amount: mealVal } });
      setMealBase(mealVal);
    } catch { /* keep usable */ }
    finally { setMealBusy(false); }
  }

  const Stat = ({ label, value, accent }) => (
    <Box sx={{ borderRadius: 3, bgcolor: "rgba(15,23,42,0.03)", px: 1.5, py: 1.25 }}>
      <Typography sx={{ fontSize: 11, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: accent || "text.primary" }}>{value}</Typography>
    </Box>
  );

  return (
    <Box sx={{ mt: 1.5, borderRadius: 4, border: "1px solid", borderColor: "rgba(79,70,229,0.20)", bgcolor: "rgba(79,70,229,0.04)", p: 1.75 }}>
      <Box sx={{ mb: 1.25, display: "flex", alignItems: "center", gap: 1, color: "#4f46e5" }}>
        <Fuel size={18} /><Typography sx={{ fontSize: 15, fontWeight: 700 }}>Diesel for this trip</Typography>
      </Box>
      {shipment.shipmentNo ? (
        <Typography sx={{ mb: 1.25, fontSize: 13, color: "text.secondary" }}>Shipment <b>{shipment.shipmentNo}</b> · {shipment.loadCount} drop{shipment.loadCount === 1 ? "" : "s"} clubbed — oil is given once, for the farthest pump.</Typography>
      ) : (
        <Typography sx={{ mb: 1.25, fontSize: 13, color: "text.secondary" }}>Single delivery (no shipment number).</Typography>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1 }}>
        <Stat label="Total RTKM" value={`${shipment.totalRtkm || 0} km`} />
        <Stat label="Longest RTKM" value={`${shipment.maxRtkm || 0} km`} accent="#4f46e5" />
        <Stat label="Tanker average" value={`${shipment.tankerAvg} km/L`} />
        <Stat label="Diesel to give" value={`${liters} L`} accent="#0f766e" />
      </Box>

      <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Oil price</Typography>
        <Box sx={{ width: 96 }}><Input type="number" inputProps={{ step: "1", min: "0" }} value={price} onChange={(e) => { setPrice(e.target.value); setSaved(false); }} /></Box>
        <Typography sx={{ fontSize: 14, color: "text.secondary", mr: "auto" }}>₹ / L</Typography>
        <Button size="sm" variant="secondary" onClick={savePrice} disabled={busy || !dirty}>{busy ? "Saving…" : dirty ? "Save price" : saved ? "Saved ✓" : "Saved"}</Button>
      </Box>
      <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Meal allowance</Typography>
        <Box sx={{ width: 96 }}><Input type="number" inputProps={{ step: "50", min: "0" }} value={meal} onChange={(e) => setMeal(e.target.value)} /></Box>
        <Typography sx={{ fontSize: 14, color: "text.secondary", mr: "auto" }}>₹ / trip</Typography>
        <Button size="sm" variant="secondary" onClick={saveMeal} disabled={mealBusy || !mealDirty}>{mealBusy ? "Saving…" : mealDirty ? "Save meal" : "Saved ✓"}</Button>
      </Box>
      <Box sx={{ mt: 1.25, borderRadius: 3, bgcolor: "rgba(16,185,129,0.10)", px: 1.75, py: 1.25 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "success.main" }}>Give driver (diesel + meal)</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "success.main" }}>{rupee(giveTotal)}</Typography>
        </Box>
        <Typography sx={{ mt: 0.25, fontSize: 12, color: "success.dark" }}>Diesel {rupee(amount)} + meal {rupee(mealVal)}</Typography>
      </Box>
      {saved && <Typography sx={{ mt: 1, fontSize: 12, color: "text.disabled" }}>Saved — this oil price now applies to every load, the ledger and all reports.</Typography>}
      {!baseline && !saved && <Typography sx={{ mt: 1, fontSize: 12, color: "warning.main" }}>No oil price set yet — enter ₹/L above and Save to value the diesel.</Typography>}
    </Box>
  );
}

const KIND_LABEL = { invoice: "Invoice", freight: "Statement of Freight", payment: "Bank Payment Advice" };

// Progress + summary when several PDFs are dropped/picked at once.
function LedgerBatchView({ batch, onDone }) {
  const done = batch.results.length;
  const finished = done >= batch.total;
  const ok = batch.results.filter((r) => r.kind && !r.duplicate && !r.needsInvoice).length;
  const dup = batch.results.filter((r) => r.duplicate).length;
  const needInv = batch.results.filter((r) => r.needsInvoice).length;
  const fail = batch.results.filter((r) => !r.kind).length;
  return (
    <Box>
      <Typography sx={{ mb: 1.5, fontSize: 14, color: "text.secondary" }}>{finished ? "All documents processed." : `Reading & filing ${done + 1} of ${batch.total}…`}</Typography>
      <Box sx={{ maxHeight: 288, overflow: "auto", borderRadius: 3, border: "1px solid", borderColor: "divider", p: 1 }}>
        {batch.results.map((r, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, px: 1, py: 0.75, fontSize: 14 }}>
            <Typography component="span" noWrap sx={{ color: "text.secondary", fontSize: 14 }}>{r.name}</Typography>
            <Typography component="span" sx={{ flexShrink: 0, fontWeight: 600, fontSize: 14, color: !r.kind ? "error.main" : (r.needsInvoice || r.duplicate) ? "warning.main" : "success.main" }}>
              {!r.kind ? "✕ couldn't read" : r.needsInvoice ? "⚠ invoice missing — skipped" : (r.duplicate ? "⚠ " : "✓ ") + (KIND_LABEL[r.kind] || r.kind)}
            </Typography>
          </Box>
        ))}
        {!finished && <Box sx={{ px: 1, py: 0.75, fontSize: 14, color: "text.disabled" }}>Reading {done + 1} of {batch.total}…</Box>}
      </Box>
      {finished && (
        <>
          <Typography sx={{ mt: 1.5, fontSize: 14, fontWeight: 500, color: "text.primary" }}>{ok} filed · {dup} duplicate · {needInv} need invoice · {fail} couldn't read</Typography>
          <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end" }}><Button onClick={onDone}>Done</Button></Box>
        </>
      )}
    </Box>
  );
}

// Single global uploader: a floating button + drag-and-drop dialog that auto-detects
// Invoice / Statement of Freight / Bank Payment Advice and files everything by itself.
export default function UploadFab() {
  const { me, activeId } = useApp();
  const [open, setOpen] = useState(false);
  if (!me || (me.role !== "owner" && me.role !== "manager")) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        Icon={UploadCloud}
        aria-label="Upload PDF"
        sx={{
          position: "fixed", bottom: 24, right: 24, zIndex: 40, borderRadius: "999px",
          px: 2.5, py: 2, color: "#fff", backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)",
          boxShadow: "0 10px 25px -5px rgba(79,70,229,0.30)", transition: "all .2s",
          "&:hover": { transform: "scale(1.05)", boxShadow: "0 20px 40px -8px rgba(79,70,229,0.45)" },
          "& .uploadFabLabel": { display: { xs: "none", sm: "inline" } },
        }}
      >
        <Typography component="span" className="uploadFabLabel" sx={{ fontSize: 14, fontWeight: 600 }}>Upload PDF</Typography>
      </Button>
      {open && <UploadDialog activeId={activeId} onClose={() => setOpen(false)} />}
    </>
  );
}

function UploadDialog({ activeId, onClose }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [batch, setBatch] = useState(null);
  const [err, setErr] = useState("");
  const [lastFile, setLastFile] = useState(null); // kept so "Process anyway" can re-submit with force

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!files.length) { setErr("Please choose PDF file(s)."); return; }
    if (!activeId) { setErr("Select a transport first."); return; }
    setErr("");
    if (files.length === 1) {
      setFileName(files[0].name); setLastFile(files[0]); setBusy(true); setResult(null);
      try { setResult(await uploadPdf("/api/ledger/upload", files[0], activeId)); }
      catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
      return;
    }
    await runBatch(files);
  }
  // User chose to import despite missing invoices → re-submit the same file with force.
  async function processAnyway() {
    if (!lastFile) return;
    setBusy(true);
    try { setResult(await uploadPdf("/api/ledger/upload", lastFile, activeId, true)); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  // Auto-detect + file every PDF, collecting a per-file outcome.
  async function runBatch(files) {
    const results = [];
    setBatch({ total: files.length, results: [] });
    for (const file of files) {
      let entry;
      try {
        // In a batch we don't force — missing-invoice docs are flagged & skipped, not silently inserted.
        const r = await uploadPdf("/api/ledger/upload", file, activeId);
        entry = { name: file.name, kind: r.kind || null, duplicate: !!r.duplicate, needsInvoice: !!r.needsConfirm, error: r.kind ? null : (r.error || "unrecognised") };
      } catch (e) { entry = { name: file.name, kind: null, error: String(e.message || e) }; }
      results.push(entry);
      setBatch({ total: files.length, results: [...results] });
    }
  }
  function onDrop(e) { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }
  const done = () => { onClose(); window.location.reload(); };

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", bgcolor: "rgba(15,23,42,0.50)", p: 2 }} onClick={onClose}>
      <Box sx={{ mt: 8, width: "100%", maxWidth: 512, borderRadius: 4, bgcolor: "background.paper", p: 2.5, boxShadow: 24 }} onClick={(e) => e.stopPropagation()}>
        <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography component="h2" sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 18, fontWeight: 700, color: "text.primary" }}><Sparkles size={20} color="#4f46e5" /> Upload document</Typography>
          <MuiIconButton onClick={onClose} sx={{ borderRadius: 2, p: 0.5, color: "text.disabled", "&:hover": { bgcolor: "rgba(15,23,42,0.05)" } }}><X size={20} /></MuiIconButton>
        </Box>

        {batch ? (
          <LedgerBatchView batch={batch} onDone={done} />
        ) : result?.needsConfirm ? (
          <Box>
            <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1, fontSize: 18, fontWeight: 700, color: "#b45309" }}>
              <AlertTriangle size={20} /> Invoice not uploaded yet
            </Box>
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
              This <b>{KIND_LABEL[result.kind] || result.kind}</b> is for {result.missingInvoices?.length} {result.kind === "payment" ? "payment line(s)" : "delivery(ies)"} whose Tax Invoice isn't in the system: <b>{(result.missingInvoices || []).join(", ")}</b>.
            </Typography>
            <Typography sx={{ mt: 1, fontSize: 14, color: "text.secondary" }}>
              <b>Nothing has been saved yet.</b> Process it now without the invoice (details may be incomplete), or skip and upload the invoices first.
            </Typography>
            <Box sx={{ mt: 2.5, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 1 }}>
              <Button variant="secondary" onClick={() => { setResult(null); setFileName(""); }}>Skip — upload invoices first</Button>
              <Button onClick={processAnyway} disabled={busy}>{busy ? "Processing…" : "Process without invoice"}</Button>
            </Box>
          </Box>
        ) : !result ? (
          <>
            <Typography sx={{ mb: 1.5, fontSize: 14, color: "text.secondary" }}>Drop one or more Nayara PDFs — <b>Invoice</b>, <b>Statement of Freight</b> or <b>Bank Payment Advice</b>. We detect each type and file every record under the right month automatically.</Typography>
            <Box
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              sx={{
                display: "flex", cursor: "pointer", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 1.5, borderRadius: 4, border: "2px dashed", p: 5, textAlign: "center", transition: "all .2s",
                ...(drag
                  ? { borderColor: "#6366f1", bgcolor: "rgba(79,70,229,0.08)" }
                  : { borderColor: "divider", bgcolor: "rgba(15,23,42,0.03)", "&:hover": { borderColor: "#818cf8", bgcolor: "rgba(79,70,229,0.04)" } }),
              }}
            >
              <Box sx={{ display: "flex", width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 4, bgcolor: "rgba(79,70,229,0.14)" }}>
                {busy ? <CircularProgress size={20} /> : <UploadCloud size={28} color="#4f46e5" />}
              </Box>
              {busy ? (
                <Typography sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>Reading &amp; filing {fileName}…</Typography>
              ) : (
                <>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>Drag &amp; drop PDF(s) here</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.disabled" }}>or click to browse — select multiple to import all at once</Typography>
                </>
              )}
              <input ref={inputRef} type="file" accept="application/pdf" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
            </Box>
            {err && <Typography sx={{ mt: 1.5, fontSize: 14, color: "error.main" }}>{err}</Typography>}
          </>
        ) : (
          <Box>
            {result.duplicate && (
              <Box sx={{ mb: 1.5, borderRadius: 3, bgcolor: "rgba(245,158,11,0.10)", px: 2, py: 1.5, fontSize: 14, color: "warning.main" }}>
                ⚠️ This exact PDF was already uploaded{result.firstSeenAt ? ` on ${new Date(result.firstSeenAt).toLocaleDateString("en-IN")}` : ""}. Re-processed safely — nothing duplicated.
              </Box>
            )}
            {result.kind ? <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1, color: "success.main" }}><CheckCircle2 size={20} /><b>Done</b></Box> : null}

            {result.kind === "invoice" ? (
              <>
                <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Detected an <b>Invoice</b> → load <b>{result.invoiceNumber}</b>{result.roName ? ` — ${result.roName}` : ""} (RTKM {result.rtkm || 0}). Date taken from the invoice.</Typography>
                <InvoiceAck shipment={result.shipment} activeId={activeId} />
              </>
            ) : result.kind === "freight" ? (
              <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Detected a <b>Statement of Freight</b>{result.reference ? ` (${result.reference})` : ""}: <b>{result.created}</b> new deliveries, <b>{result.updated}</b> updated, <b>{result.shortagesCreated}</b> driver shortages queued.</Typography>
            ) : result.kind === "payment" ? (
              <Box sx={{ fontSize: 14, color: "text.secondary" }}>
                <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Detected a <b>Bank Payment Advice</b> — <b>{result.matched}</b> deliveries settled{result.unmatched ? `, ${result.unmatched} line(s) for other periods` : ""}.</Typography>
                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 0.75, borderRadius: 3, bgcolor: "rgba(15,23,42,0.03)", p: 1.5 }}>
                  <span>Gross freight</span><Typography component="b" sx={{ textAlign: "right", fontWeight: 700 }}>{rupee(result.totalGross)}</Typography>
                  <span>TDS</span><Typography component="b" sx={{ textAlign: "right", fontWeight: 700 }}>− {rupee(result.totalTds)}</Typography>
                  <span>Deductions</span><Typography component="b" sx={{ textAlign: "right", fontWeight: 700 }}>− {rupee(result.totalDed)}</Typography>
                  <Typography component="span" sx={{ color: "success.main" }}>Received</Typography><Typography component="b" sx={{ textAlign: "right", fontWeight: 700, color: "success.main" }}>{rupee(result.totalReceived)}</Typography>
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontSize: 14, color: "error.main" }}>{result.error || "Couldn't recognise this document."}</Typography>
                {result.textPreview ? (
                  <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer" }}><Typography component="span" sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>Show extracted text</Typography></summary>
                    <Box component="pre" sx={{ mt: 1, maxHeight: 192, overflow: "auto", whiteSpace: "pre-wrap", borderRadius: 3, bgcolor: "#0f172a", p: 1.5, fontSize: 12, color: "#f1f5f9" }}>{result.textPreview}</Box>
                  </details>
                ) : null}
              </Box>
            )}

            {result.kind ? <UploadValidation result={result} activeId={activeId} /> : null}

            <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button variant="secondary" onClick={() => { setResult(null); setFileName(""); }}>Upload another</Button>
              <Button onClick={done}>Done</Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
