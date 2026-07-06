"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { mutate as globalMutate } from "swr";
import { Card, Button, Input, Select, useConfirm } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { Box, Typography } from "@mui/material";
import { Mail, CheckCircle2, Plug, Link2Off, FileText, Fuel, UploadCloud, AlertTriangle, Trash2 } from "@/components/icons";

export default function SettingsPage() {
  const { me, activeId, transports, reloadTransports } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [senders, setSenders] = useState(null); // null until prefilled from saved senders
  const [savingSenders, setSavingSenders] = useState(false);
  const [sendersSaved, setSendersSaved] = useState(false);
  const [days, setDays] = useState("365"); // preset window, or "custom"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } during the per-email loop
  const [result, setResult] = useState(null);
  const [importErr, setImportErr] = useState("");

  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("gmail");
    if (g === "connected") setMsg("✓ Gmail connected.");
    else if (g === "norefresh") setMsg("Google didn't return access. Disconnect, then connect again.");
    else if (g === "error") setMsg("Could not connect Gmail. Please try again.");
    if (g) window.history.replaceState({}, "", "/app/settings");
  }, []);

  const { data: statusData, mutate: mutateStatus } = useApi(activeId ? `/api/integrations/gmail/status?transportId=${activeId}` : null);
  const status = statusData?.gmail;

  // Prefill the sender box once from whatever was saved last time.
  useEffect(() => { if (senders === null && status?.senders) setSenders(status.senders.join(", ")); }, [status, senders]);

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  const connect = () => { window.location.href = `/api/integrations/gmail/connect?transportId=${activeId}`; };
  async function disconnect() {
    setBusy(true);
    try { await api("/api/integrations/gmail/disconnect", { method: "POST", body: { transportId: activeId } }); mutateStatus(); }
    finally { setBusy(false); }
  }
  async function saveSenders() {
    setSavingSenders(true);
    try {
      const list = (senders || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      await api("/api/integrations/gmail/senders", { method: "POST", body: { transportId: activeId, senders: list } });
      setSendersSaved(true); mutateStatus();
    } catch (e) { setMsg(String(e.message || e)); }
    finally { setSavingSenders(false); }
  }
  async function importAll() {
    setResult(null); setImportErr(""); setProgress(null);
    const custom = days === "custom";
    if (custom && !from && !to) { setImportErr("Pick a from and/or to date for the custom range."); return; }
    setImporting(true);
    try {
      const sList = (senders || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const scanBody = { transportId: activeId, senders: sList, save: true };
      if (custom) { if (from) scanBody.after = from; if (to) scanBody.before = to; }
      else scanBody.days = Number(days);

      // Start date → also drop statement/invoice ROWS dated before it (statements received in your
      // window often list the previous fortnight's deliveries; this keeps the ledger to the start date).
      const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
      const minDate = custom ? (from || "") : isoDate(Date.now() - Number(days) * 86400000);

      // 1) Fast scan for matching email IDs in the SELECTED window only (no pre-start lookback).
      const ids = (await api("/api/integrations/gmail/scan-ids", { method: "POST", body: scanBody, timeout: 120000 })).ids || [];
      if (!ids.length) { setResult({ scanned: 0, imported: 0, counts: {} }); return; }

      // 2) Import one email at a time so progress shows and nothing times out.
      setProgress({ done: 0, total: ids.length });
      const counts = { invoice: 0, freight: 0, payment: 0, fastag: 0, duplicates: 0, unrecognised: 0, failed: 0, skipped: 0 };
      for (let i = 0; i < ids.length; i++) {
        try {
          const r = await api("/api/integrations/gmail/import-message", { method: "POST", body: { transportId: activeId, messageId: ids[i], minDate }, timeout: 90000 });
          for (const k of Object.keys(counts)) counts[k] += (r.counts?.[k] || 0);
        } catch { counts.failed++; }
        setProgress({ done: i + 1, total: ids.length });
      }

      const imported = counts.invoice + counts.freight + counts.payment + counts.fastag;
      setResult({ scanned: ids.length, imported, counts });
      mutateStatus();
    } catch (e) { setImportErr(String(e.message || e)); }
    finally { setImporting(false); setProgress(null); }
  }

  const connected = status?.connected;
  const isOwner = me?.role === "owner";
  const activeTransport = transports?.find((t) => t.id === activeId);
  return (
    <Box sx={{ maxWidth: 672, display: "flex", flexDirection: "column", gap: 2 }}>
      {msg && <Box className="glass" sx={{ borderRadius: 3, px: 2, py: 1.5, fontSize: 14, fontWeight: 500, color: "primary.dark" }}>{msg}</Box>}

      {isOwner && activeTransport && (
        <TankerAvgCard transport={activeTransport} onSaved={async (avg) => { setMsg(`✓ Tanker average set to ${avg} km/L. Oil recalculated for all shipments.`); await reloadTransports(); }} />
      )}

      <Card>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box component="span" sx={{ display: "flex", height: 48, width: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(244,63,94,0.08)" }}><Mail size={24} color="#f43f5e" /></Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Gmail import</Typography>
              {connected && <CheckCircle2 size={20} color="#10b981" />}
            </Box>
            <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>Pull invoice &amp; shortage PDFs straight from your inbox instead of uploading by hand. Manual upload still works everywhere.</Typography>

            {connected ? (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ borderRadius: 3, bgcolor: "rgba(16,185,129,0.08)", px: 2, py: 1.5, fontSize: 14, color: "success.main" }}>
                  Connected as <b>{status.email || "your account"}</b>
                  {status.lastScanAt ? ` · last scan ${new Date(status.lastScanAt).toLocaleString("en-IN")}` : ""}
                </Box>
                {/* Bulk import: scan the inbox and auto-file every statement at once */}
                <Box sx={{ mt: 2, borderRadius: 3, border: "1px solid", borderColor: "rgba(79,70,229,0.18)", bgcolor: "rgba(79,70,229,0.04)", p: 2 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "text.primary", display: "flex", alignItems: "center", gap: 0.75 }}>
                    <UploadCloud size={18} color="#4f46e5" /> Import all statements at once
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 13, color: "text.secondary" }}>
                    Scans your inbox and auto-files every PDF — invoices, freight statements, payment advices and FASTag/BlackBuck statements. Anything already imported is skipped automatically. Only emails within your selected period are imported.
                  </Typography>

                  <Box sx={{ mt: 1.5, borderRadius: 3, border: "1px solid", borderColor: "rgba(79,70,229,0.18)", bgcolor: "rgba(79,70,229,0.03)", p: 1.5 }}>
                    <Typography component="label" sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>Trusted senders (for alerts &amp; auto-import)</Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
                      Only emails from/to these get a bell alert and bulk-import. <b>Leave blank and you get NO Gmail alerts</b> (so random inbox PDFs never notify). For Nayara use <b>nayaraenergy.com</b> and your bank, e.g. <b>icici.bank.in</b>.
                    </Typography>
                    <Box component="textarea" rows={2} value={senders || ""} onChange={(e) => { setSenders(e.target.value); setSendersSaved(false); }}
                      placeholder="nayaraenergy.com, icici.bank.in"
                      sx={{ width: "100%", resize: "vertical", borderRadius: 2, border: "1px solid", borderColor: "rgba(203,213,225,0.9)", bgcolor: "#fff", p: 1.25, fontSize: 14, fontFamily: "inherit", color: "text.primary", outline: "none", "&:focus": { borderColor: "primary.main" } }} />
                    <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Button size="sm" onClick={saveSenders} disabled={savingSenders}>{savingSenders ? "Saving…" : sendersSaved ? "Saved ✓" : "Save senders"}</Button>
                      <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>Comma- or line-separated. A bare domain matches everyone at that company (from, to or cc).</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 1.5 }}>
                    <Box>
                      <Typography component="label" sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>Period</Typography>
                      <Select value={days} onChange={(e) => setDays(e.target.value)} sx={{ width: "auto", minWidth: 150 }}>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="180">Last 6 months</option>
                        <option value="365">Last 1 year</option>
                        <option value="730">Last 2 years</option>
                        <option value="custom">Custom range…</option>
                      </Select>
                    </Box>
                    {days === "custom" && (
                      <>
                        <Box>
                          <Typography component="label" sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>From</Typography>
                          <Box sx={{ width: 150 }}><DatePicker value={from} onChange={setFrom} placeholder="Start date" /></Box>
                        </Box>
                        <Box>
                          <Typography component="label" sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>To</Typography>
                          <Box sx={{ width: 150 }}><DatePicker value={to} onChange={setTo} placeholder="End date" /></Box>
                        </Box>
                      </>
                    )}
                    <Button Icon={UploadCloud} onClick={importAll} disabled={importing}>
                      {importing ? (progress ? `Importing ${progress.done}/${progress.total}…` : "Scanning inbox…") : "Import all now"}
                    </Button>
                    <Button variant="secondary" Icon={Link2Off} onClick={disconnect} disabled={busy || importing}>Disconnect</Button>
                  </Box>
                  {importing && (
                    <Box sx={{ mt: 1.5 }}>
                      <Box sx={{ height: 8, borderRadius: 999, bgcolor: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
                        <Box sx={{ height: "100%", borderRadius: 999, bgcolor: "primary.main", transition: "width .2s", width: progress && progress.total ? `${Math.round((progress.done / progress.total) * 100)}%` : "12%" }} />
                      </Box>
                      <Typography sx={{ mt: 0.75, fontSize: 12.5, color: "text.secondary" }}>
                        {progress ? `Imported ${progress.done} of ${progress.total} emails — keep this tab open.` : "Scanning your inbox for matching PDFs…"}
                      </Typography>
                    </Box>
                  )}
                  {days === "custom" && (
                    <Typography sx={{ mt: 0.75, fontSize: 11.5, color: "text.disabled" }}>
                      Leave one side blank for open-ended (e.g. only <b>From</b> = everything since that date).
                    </Typography>
                  )}

                  {importErr && <Typography sx={{ mt: 1.5, fontSize: 13.5, color: "error.main" }}>{importErr}</Typography>}
                  {result && <ImportResult result={result} />}
                </Box>

                <Typography sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 0.75, fontSize: 12, color: "text.disabled" }}>
                  <FileText size={14} /> Or import one at a time: open <b style={{ color: "#64748b" }}>Loads</b> or <b style={{ color: "#64748b" }}>Shortages</b> → Upload → <b style={{ color: "#64748b" }}>From email</b>.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                <Button Icon={Plug} onClick={connect}>Connect Gmail</Button>
                <Typography sx={{ mt: 1.5, fontSize: 12, color: "text.disabled" }}>Read-only access — we only read PDF attachments when you import them.</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Card>

      {isOwner && activeTransport && (
        <DangerZone transport={activeTransport} onWiped={(d) => setMsg(`✓ Fresh start done — removed ${d.total} record(s) from ${activeTransport.name}.`)} />
      )}
    </Box>
  );
}

// Owner self-service "fresh start": wipe this transport's transactional data (test uploads etc.).
function DangerZone({ transport, onWiped }) {
  const [includeFleet, setIncludeFleet] = useState(false);
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  async function wipe() {
    const ok = await confirm({
      title: `Wipe all data for "${transport.name}"?`,
      message: includeFleet
        ? "This permanently deletes ALL loads, shortages, salaries, settlements, uploads, FASTag, maintenance, leaves, extra oil, meter readings, gate-in events, document alerts and notifications — AND this transport's trucks & driver/manager logins. Master pumps and your owner account are kept. This cannot be undone."
        : "This permanently deletes ALL loads, shortages, salaries, settlements, uploads, FASTag, maintenance, leaves, extra oil, meter readings, gate-in events, document alerts and notifications for this transport. Your trucks, drivers, master pumps and account are kept. This cannot be undone.",
      confirmLabel: "Wipe data",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const d = await api(`/api/transports/${transport.id}/wipe`, { method: "POST", body: { includeFleet }, timeout: 120000, retries: 0 });
      await globalMutate(() => true); // refresh every cached screen
      onWiped?.(d);
    } catch (e) {
      onWiped?.({ total: 0, error: String(e.message || e) });
    } finally { setBusy(false); }
  }

  return (
    <Card sx={{ border: "1px solid", borderColor: "rgba(225,29,72,0.3)", bgcolor: "rgba(225,29,72,0.03)" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box component="span" sx={{ display: "flex", height: 48, width: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(225,29,72,0.1)" }}><AlertTriangle size={24} color="#e11d48" /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "error.main" }}>Danger zone — fresh start</Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>
            Tested with random PDFs? Wipe all of <b>{transport.name}</b>'s data and start clean. This removes loads,
            shortages, salaries, settlements, uploads, FASTag, maintenance, leaves, extra oil, meter readings and
            notifications. <b>Master pumps and your login are never touched</b>, and other owners' data is unaffected.
          </Typography>
          <Box component="label" sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 0.75, fontSize: 14, color: "text.primary", cursor: "pointer" }}>
            <Box component="input" type="checkbox" checked={includeFleet} onChange={(e) => setIncludeFleet(e.target.checked)} sx={{ width: 16, height: 16 }} />
            Also remove trucks &amp; driver / manager logins
          </Box>
          <Box sx={{ mt: 1.5 }}>
            <Button variant="danger" Icon={Trash2} onClick={wipe} disabled={busy}>{busy ? "Wiping…" : "Wipe my data"}</Button>
          </Box>
        </Box>
      </Box>
      {ConfirmModal}
    </Card>
  );
}

// Summary of a bulk Gmail import run.
function ImportResult({ result }) {
  const c = result.counts || {};
  const chips = [
    ["Invoices", c.invoice], ["Freight statements", c.freight], ["Payments", c.payment], ["FASTag", c.fastag],
    ["Duplicates skipped", c.duplicates], ["Before start date", c.skipped], ["Unrecognised", c.unrecognised], ["Failed", c.failed],
  ].filter(([, n]) => n > 0);
  return (
    <Box sx={{ mt: 1.5, borderRadius: 2.5, bgcolor: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", p: 1.5 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "success.main" }}>
        Scanned {result.scanned} PDF{result.scanned === 1 ? "" : "s"} · imported {result.imported}
      </Typography>
      {chips.length > 0 && (
        <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {chips.map(([label, n]) => (
            <Box key={label} sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", bgcolor: "rgba(255,255,255,0.7)", border: "1px solid", borderColor: "divider", borderRadius: 999, px: 1, py: 0.25 }}>
              {label}: {n}
            </Box>
          ))}
        </Box>
      )}
      {(c.unrecognised > 0 || c.failed > 0) && (
        <Typography sx={{ mt: 1, fontSize: 12, color: "text.disabled" }}>
          Unrecognised/failed files are left untouched in your inbox — upload them manually if needed.
        </Typography>
      )}
    </Box>
  );
}

// A single clearly-labelled setting: bold label, input with its unit, and a plain-language hint.
function SettingField({ label, unit, value, onChange, placeholder, step, min, hint }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="label" sx={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "text.primary", mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", alignItems: "center", borderRadius: 2, border: "1px solid", borderColor: "rgba(203,213,225,0.9)", bgcolor: "rgba(255,255,255,0.8)", pr: 1.25, "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 2px rgba(79,70,229,0.12)" } }}>
        <Box component="input" type="number" inputMode="decimal" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          sx={{ flex: 1, minWidth: 0, border: "none", outline: "none", bgcolor: "transparent", py: 1.25, px: 1.25, fontSize: 16, fontWeight: 600, color: "text.primary", "&::placeholder": { color: "text.disabled", fontWeight: 400 } }} />
        <Box component="span" sx={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: "text.secondary", whiteSpace: "nowrap" }}>{unit}</Box>
      </Box>
      <Typography sx={{ mt: 0.5, fontSize: 11.5, color: "text.disabled", lineHeight: 1.45 }}>{hint}</Typography>
    </Box>
  );
}

function TankerAvgCard({ transport, onSaved }) {
  const [avg, setAvg] = useState(String(transport.tankerAvg ?? 4.5));
  const [price, setPrice] = useState(String(transport.dieselPrice ?? 0));
  const [meal, setMeal] = useState(String(transport.mealAllowancePerTrip ?? 0));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAvg(String(transport.tankerAvg ?? 4.5)); setPrice(String(transport.dieselPrice ?? 0));
    setMeal(String(transport.mealAllowancePerTrip ?? 0));
  }, [transport.id, transport.tankerAvg, transport.dieselPrice, transport.mealAllowancePerTrip]);

  async function save() {
    const v = Number(avg);
    if (!(v > 0)) return;
    setBusy(true);
    try { await api(`/api/transports/${transport.id}`, { method: "PUT", body: { tankerAvg: v, dieselPrice: Number(price) || 0, mealAllowancePerTrip: Number(meal) || 0 } }); onSaved?.(v); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box component="span" sx={{ display: "flex", height: 48, width: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(37,99,235,0.08)" }}><Fuel size={24} color="#2563eb" /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Diesel &amp; trip settings</Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>These three numbers turn each trip into real ₹ in your Spend &amp; Profit reports. Set them once.</Typography>

          <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            <SettingField
              label="Tanker mileage" unit="km / L" value={avg} onChange={setAvg}
              placeholder="e.g. 4.5" step="0.1" min="0.1"
              hint="How far the tanker runs on 1 litre. Used to work out the diesel for each trip." />
            <SettingField
              label="Diesel price" unit="₹ / litre" value={price} onChange={setPrice}
              placeholder="e.g. 95" step="1" min="0"
              hint="What you pay for 1 litre of diesel. Turns diesel given into a ₹ cost." />
            <SettingField
              label="Meal allowance" unit="₹ / trip" value={meal} onChange={setMeal}
              placeholder="e.g. 1000" step="50" min="0"
              hint="Flat food / expense money you give the driver each trip. Put 0 if none." />
          </Box>

          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Button onClick={save} disabled={busy || !(Number(avg) > 0)}>{busy ? "Saving…" : "Save settings"}</Button>
            <Typography sx={{ fontSize: 12.5, color: "text.disabled" }}>Saving updates the diesel cost on every trip.</Typography>
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
