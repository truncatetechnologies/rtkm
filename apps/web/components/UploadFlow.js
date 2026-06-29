"use client";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Upload, Mail } from "@/components/icons";
import { Modal, Button, Field, Input, Select, cn } from "@/components/ui";
import { uploadPdf, api, COMPANIES } from "@/lib/clientApi";

// Progress + summary for an auto-import batch (multiple PDFs picked at once).
function BatchProgress({ batch, onDone }) {
  const done = batch.results.length;
  const finished = done >= batch.total;
  const count = (s) => batch.results.filter((r) => r.status === s).length;
  const colorOf = { added: "success.main", duplicate: "warning.main", failed: "error.main" };
  const iconOf = { added: "✓", duplicate: "⚠", failed: "✕" };
  return (
    <Box>
      <Typography sx={{ mb: 1.5, fontSize: 14, color: "text.secondary" }}>{finished ? "All documents processed." : `Reading ${done + 1} of ${batch.total}…`}</Typography>
      <Box sx={{ maxHeight: 288, overflow: "auto", borderRadius: 3, border: "1px solid", borderColor: "divider", p: 1 }}>
        {batch.results.map((r, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, px: 1, py: 0.5, fontSize: 14 }}>
            <Typography component="span" noWrap sx={{ color: "text.secondary", fontSize: 14 }}>{r.name}</Typography>
            <Typography component="span" sx={{ flexShrink: 0, fontWeight: 600, fontSize: 14, color: colorOf[r.status] }}>{iconOf[r.status]} {r.status}</Typography>
          </Box>
        ))}
        {!finished && <Box sx={{ px: 1, py: 0.5, fontSize: 14, color: "text.disabled" }}>Reading {done + 1} of {batch.total}…</Box>}
      </Box>
      {finished && (
        <>
          <Typography sx={{ mt: 1.5, fontSize: 14, fontWeight: 500, color: "text.primary" }}>{count("added")} added · {count("duplicate")} duplicate · {count("failed")} failed</Typography>
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}><Button onClick={onDone}>Done</Button></Box>
        </>
      )}
    </Box>
  );
}

// Source switcher (file vs email) shown on the "pick" step.
function SourceTabs({ source, setSource }) {
  const tab = (k, label, Icon) => (
    <Button onClick={() => setSource(k)} variant="ghost"
      sx={{
        display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 0.75,
        borderRadius: 2, py: 1, fontSize: 14, fontWeight: 600, transition: "all .2s",
        ...(source === k
          ? { bgcolor: "background.paper", color: "primary.main", boxShadow: 1 }
          : { color: "text.secondary" }),
      }}>
      <Icon size={16} /> {label}
    </Button>
  );
  return (
    <Box sx={{ mb: 2, display: "flex", borderRadius: 3, bgcolor: "rgba(15,23,42,0.05)", p: 0.5 }}>
      {tab("file", "Upload file", Upload)}
      {tab("email", "From email", Mail)}
    </Box>
  );
}

// Scan a connected Gmail inbox and import a PDF attachment → onImported(parsedResult).
function EmailScan({ transportId, kind, onImported }) {
  const [state, setState] = useState("checking"); // checking | disconnected | idle | scanning | importing
  const [messages, setMessages] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/api/integrations/gmail/status?transportId=${transportId}`)
      .then((d) => setState(d.gmail?.connected ? "idle" : "disconnected"))
      .catch(() => setState("disconnected"));
  }, [transportId]);

  async function scan() {
    setState("scanning"); setErr("");
    try { const d = await api(`/api/integrations/gmail/messages?transportId=${transportId}`); setMessages(d.messages || []); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setState("idle"); }
  }
  async function importMsg(m) {
    setState("importing"); setErr("");
    try {
      const r = await api("/api/integrations/gmail/import", { method: "POST", body: { transportId, kind, messageId: m.messageId, attachmentId: m.attachmentId, filename: m.filename } });
      onImported(r);
    } catch (e) { setErr(String(e.message || e)); setState("idle"); }
  }

  if (state === "checking") return <Typography sx={{ fontSize: 14, color: "text.disabled" }}>Checking Gmail…</Typography>;
  if (state === "disconnected")
    return <Box sx={{ borderRadius: 3, bgcolor: "rgba(245,158,11,0.10)", p: 2, fontSize: 14, color: "warning.main" }}>Gmail isn't connected. Go to <Box component="a" sx={{ fontWeight: 600, textDecoration: "underline", color: "inherit" }} href="/app/settings">Settings → Connect Gmail</Box>, then come back.</Box>;

  return (
    <Box>
      <Button variant="secondary" Icon={Mail} onClick={scan} disabled={state === "scanning"}>
        {state === "scanning" ? "Scanning inbox…" : "Scan inbox for PDFs"}
      </Button>
      {err && <Typography sx={{ mt: 1, fontSize: 14, color: "error.main" }}>{err}</Typography>}
      <Box sx={{ mt: 1.5, maxHeight: 320, overflow: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {messages.map((m) => (
          <Box component="button" key={m.messageId + m.attachmentId} onClick={() => importMsg(m)} disabled={state === "importing"}
            sx={{ display: "block", width: "100%", borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "rgba(255,255,255,0.70)", p: 1.5, textAlign: "left", cursor: "pointer", transition: "all .2s", "&:hover": { borderColor: "#a5b4fc" }, "&:disabled": { opacity: 0.5 } }}>
            <Box sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.filename}</Box>
            <Box sx={{ fontSize: 12, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from}{m.subject ? ` · ${m.subject}` : ""}</Box>
            <Box sx={{ fontSize: 12, color: "text.disabled" }}>{m.date}{m.sizeKB ? ` · ${m.sizeKB} KB` : ""}</Box>
          </Box>
        ))}
        {state === "idle" && messages.length === 0 && <Typography sx={{ fontSize: 14, color: "text.disabled" }}>No PDFs loaded yet — tap "Scan inbox".</Typography>}
      </Box>
      {state === "importing" && <Typography sx={{ mt: 1, fontSize: 14, color: "text.disabled" }}>Reading attachment…</Typography>}
    </Box>
  );
}

// Invoice PDF → review parsed fields → create a Load.
export function InvoiceUploadModal({ transportId, onClose, onDone }) {
  const [source, setSource] = useState("file");
  const [step, setStep] = useState("pick"); // pick | review | batch
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [uploadId, setUploadId] = useState(null);
  const [dup, setDup] = useState(null);
  const [batch, setBatch] = useState(null);
  const [f, setF] = useState({ company: "", invoiceNumber: "", invoiceDate: "", roName: "", pumpCode: "", address: "", fromLocation: "", toLocation: "", supplyLocation: "", product: "", loadQtyL: "", truckReg: "", shipmentNo: "", lrNumber: "", rtkm: "", averageKmL: 4, ratePerL: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function applyDraft(r) { setUploadId(r.uploadId); setDup(r.duplicate ? r : null); setF((cur) => ({ ...cur, ...r.draft, averageKmL: cur.averageKmL })); setStep("review"); }

  async function onFile(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    if (files.length === 1) {
      setBusy(true); setErr("");
      try { applyDraft(await uploadPdf("/api/uploads/invoice", files[0], transportId)); }
      catch (e2) { setErr(String(e2.message || e2)); } finally { setBusy(false); }
      return;
    }
    await runBatch(files);
  }
  // Auto-import many invoices: parse + save each, collect a per-file result.
  async function runBatch(files) {
    setErr(""); setStep("batch");
    const results = [];
    setBatch({ total: files.length, results: [] });
    for (const file of files) {
      let status = "added";
      try {
        const up = await uploadPdf("/api/uploads/invoice", file, transportId);
        await api("/api/loads/from-invoice", { method: "POST", body: { transportId, uploadId: up.uploadId, ...up.draft, averageKmL: 4 } });
        if (up.duplicate) status = "duplicate";
      } catch { status = "failed"; }
      results.push({ name: file.name, status });
      setBatch({ total: files.length, results: [...results] });
    }
  }
  async function confirm() {
    setBusy(true); setErr("");
    try { await api("/api/loads/from-invoice", { method: "POST", body: { transportId, uploadId, ...f } }); onDone?.(); }
    catch (e2) { setErr(String(e2.message || e2)); } finally { setBusy(false); }
  }

  return (
    <Modal title="Add invoice" wide onClose={onClose}>
      {step === "pick" && (
        <Box>
          <SourceTabs source={source} setSource={setSource} />
          {source === "file" ? (
            <Box>
              <Typography sx={{ mb: 1.5, fontSize: 14, color: "text.secondary" }}>Upload the company invoice (Nayara / BPCL / IndianOil). <b>Select multiple PDFs</b> to import them all at once, or one to review before saving.</Typography>
              <input type="file" accept="application/pdf" multiple onChange={onFile} />
              {busy && <Typography sx={{ mt: 1, fontSize: 14, color: "text.disabled" }}>Reading PDF…</Typography>}
            </Box>
          ) : (
            <EmailScan transportId={transportId} kind="invoice" onImported={applyDraft} />
          )}
          {err && <Typography sx={{ mt: 1, fontSize: 14, color: "error.main" }}>{err}</Typography>}
        </Box>
      )}
      {step === "batch" && batch && <BatchProgress batch={batch} onDone={onDone} />}
      {step === "review" && (
        <Box>
          {dup && <Box sx={{ mb: 1.5, borderRadius: 3, bgcolor: "rgba(245,158,11,0.10)", px: 2, py: 1, fontSize: 14, color: "warning.main" }}>⚠️ This PDF was already uploaded{dup.firstSeenAt ? ` on ${new Date(dup.firstSeenAt).toLocaleDateString("en-IN")}` : ""}. Saving will update the existing load, not create a duplicate.</Box>}
          <Typography sx={{ mb: 1.5, fontSize: 14, color: "text.secondary" }}>Review the extracted details, fix anything, then save.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.5 }}>
            <Field label="Pump name"><Input value={f.roName} onChange={set("roName")} /></Field>
            <Field label="Pump ID (code)"><Input value={f.pumpCode} onChange={set("pumpCode")} /></Field>
            <Field label="Pump address" sx={{ gridColumn: "span 2" }}><Input value={f.address} onChange={set("address")} /></Field>
            <Field label="Invoice number"><Input value={f.invoiceNumber} onChange={set("invoiceNumber")} /></Field>
            <Field label="Invoice date"><Input value={f.invoiceDate} onChange={set("invoiceDate")} /></Field>
            <Field label="Depot / from"><Input value={f.fromLocation} onChange={set("fromLocation")} /></Field>
            <Field label="Company"><Select value={f.company} onChange={set("company")}><option value="">—</option>{COMPANIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</Select></Field>
            <Field label="Vehicle / tanker reg"><Input value={f.truckReg || ""} onChange={set("truckReg")} /></Field>
            <Field label="Volume (L)"><Input type="number" value={f.loadQtyL} onChange={set("loadQtyL")} /></Field>
            <Field label="Product code"><Input value={f.product} onChange={set("product")} /></Field>
            <Field label="Shipment no"><Input value={f.shipmentNo} onChange={set("shipmentNo")} /></Field>
            <Field label="RTKM (optional)"><Input type="number" value={f.rtkm} onChange={set("rtkm")} /></Field>
            <Field label="Diesel rate ₹/L (optional)"><Input type="number" value={f.ratePerL} onChange={set("ratePerL")} /></Field>
          </Box>
          {err && <Typography sx={{ mt: 1, fontSize: 14, color: "error.main" }}>{err}</Typography>}
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Save load"}</Button>
          </Box>
        </Box>
      )}
    </Modal>
  );
}

// Shortage PDF → review → map to load by invoice → create Shortage (salary deduction).
export function ShortageUploadModal({ transportId, onClose, onDone }) {
  const [source, setSource] = useState("file");
  const [step, setStep] = useState("pick");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [dup, setDup] = useState(null);
  const [batch, setBatch] = useState(null);
  const [f, setF] = useState({ invoiceNumber: "", shortageL: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function applyDraft(r) { setUploadId(r.uploadId); setDup(r.duplicate ? r : null); setF({ invoiceNumber: r.draft?.invoiceNumber || "", shortageL: r.draft?.shortageL || "" }); setStep("review"); }

  async function onFile(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    if (files.length === 1) {
      setBusy(true); setErr("");
      try {
        const r = await uploadPdf("/api/uploads/shortage", files[0], transportId);
        if (r.delivery) { setResult({ delivery: true, ...r }); setStep("done"); }
        else applyDraft(r);
      } catch (e2) { setErr(String(e2.message || e2)); } finally { setBusy(false); }
      return;
    }
    await runBatch(files);
  }
  // Auto-import many shortage / statement PDFs: process each, collect a per-file result.
  async function runBatch(files) {
    setErr(""); setStep("batch");
    const results = [];
    setBatch({ total: files.length, results: [] });
    for (const file of files) {
      let status = "added";
      try {
        const up = await uploadPdf("/api/uploads/shortage", file, transportId);
        if (!up.delivery) {
          await api("/api/shortages/from-pdf", { method: "POST", body: { transportId, uploadId: up.uploadId, ...up.draft } });
          if (up.duplicate) status = "duplicate";
        } // delivery statements are processed server-side on upload
      } catch { status = "failed"; }
      results.push({ name: file.name, status });
      setBatch({ total: files.length, results: [...results] });
    }
  }
  async function confirm() {
    setBusy(true); setErr("");
    try { const r = await api("/api/shortages/from-pdf", { method: "POST", body: { transportId, uploadId, ...f } }); setResult(r); setStep("done"); }
    catch (e2) { setErr(String(e2.message || e2)); } finally { setBusy(false); }
  }

  return (
    <Modal title="Add shortage / delivery statement" onClose={onClose}>
      {step === "pick" && (
        <Box>
          <SourceTabs source={source} setSource={setSource} />
          {source === "file" ? (
            <Box>
              <Typography sx={{ mb: 1.5, fontSize: 14, color: "text.secondary" }}>Upload a single shortage report, <b>or the full Delivery / Freight Statement</b> — we'll read the table and map each row to its invoice (recording RTKM, freight & shortage). <b>Select multiple PDFs</b> to process them all at once.</Typography>
              <input type="file" accept="application/pdf" multiple onChange={onFile} />
              {busy && <Typography sx={{ mt: 1, fontSize: 14, color: "text.disabled" }}>Reading PDF…</Typography>}
            </Box>
          ) : (
            <EmailScan transportId={transportId} kind="shortage" onImported={applyDraft} />
          )}
          {err && <Typography sx={{ mt: 1, fontSize: 14, color: "error.main" }}>{err}</Typography>}
        </Box>
      )}
      {step === "batch" && batch && <BatchProgress batch={batch} onDone={onDone} />}
      {step === "review" && (
        <Box>
          {dup && <Box sx={{ mb: 1.5, borderRadius: 3, bgcolor: "rgba(245,158,11,0.10)", px: 2, py: 1, fontSize: 14, color: "warning.main" }}>⚠️ This PDF was already uploaded{dup.firstSeenAt ? ` on ${new Date(dup.firstSeenAt).toLocaleDateString("en-IN")}` : ""}.</Box>}
          <Typography sx={{ mb: 1.5, fontSize: 14, color: "text.secondary" }}>Confirm the invoice number (used to find the load) and shortage quantity.</Typography>
          <Field label="Invoice number"><Input value={f.invoiceNumber} onChange={set("invoiceNumber")} /></Field>
          <Box sx={{ mt: 1.5 }}><Field label="Shortage (L)"><Input type="number" value={f.shortageL} onChange={set("shortageL")} /></Field></Box>
          {err && <Typography sx={{ mt: 1, fontSize: 14, color: "error.main" }}>{err}</Typography>}
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Record shortage"}</Button>
          </Box>
        </Box>
      )}
      {step === "done" && (
        <Box>
          {result?.delivery ? (
            <Typography sx={{ color: "success.main" }}>Delivery statement processed{result.reference ? ` (${result.reference})` : ""}: <b>{result.created}</b> new + <b>{result.updated}</b> updated deliveries mapped to invoices, <b>{result.shortagesCreated}</b> shortage(s) recorded. See the <b>Ledger</b> for freight & settlement.</Typography>
          ) : (
            <Typography sx={{ color: "success.main" }}>Shortage recorded. Deduction queued: <b>₹{Math.round(result?.mappedTo?.deduction || 0).toLocaleString("en-IN")}</b> on the driver's next payslip.</Typography>
          )}
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}><Button onClick={onDone}>Done</Button></Box>
        </Box>
      )}
    </Modal>
  );
}
