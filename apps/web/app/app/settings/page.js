"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Input, Select } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { Mail, CheckCircle2, Plug, Link2Off, FileText, Fuel, UploadCloud } from "@/components/icons";

export default function SettingsPage() {
  const { me, activeId, transports, reloadTransports } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [senders, setSenders] = useState(null); // null until prefilled from saved senders
  const [days, setDays] = useState("365");
  const [importing, setImporting] = useState(false);
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
  async function importAll() {
    setImporting(true); setResult(null); setImportErr("");
    try {
      const sList = (senders || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const r = await api("/api/integrations/gmail/import-all", { method: "POST", body: { transportId: activeId, senders: sList, days: Number(days), save: true }, timeout: 600000, retries: 0 });
      setResult(r);
      mutateStatus();
    } catch (e) { setImportErr(String(e.message || e)); }
    finally { setImporting(false); }
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
                    Scans your inbox and auto-files every PDF — invoices, freight statements, payment advices and FASTag/BlackBuck statements. Anything already imported is skipped automatically.
                  </Typography>

                  <Box sx={{ mt: 1.5 }}>
                    <Typography component="label" sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>Only from these senders (optional)</Typography>
                    <Box component="textarea" rows={2} value={senders || ""} onChange={(e) => setSenders(e.target.value)}
                      placeholder="@nayaraenergy.com, @blackbuck.com"
                      sx={{ mt: 0.5, width: "100%", resize: "vertical", borderRadius: 2, border: "1px solid", borderColor: "rgba(203,213,225,0.9)", bgcolor: "rgba(255,255,255,0.8)", p: 1.25, fontSize: 14, fontFamily: "inherit", color: "text.primary", outline: "none", "&:focus": { borderColor: "primary.main" } }} />
                    <Typography sx={{ mt: 0.5, fontSize: 11.5, color: "text.disabled" }}>
                      Use a domain like <b>@nayaraenergy.com</b> to catch every sender at that company (pankaj@…, dheeraj@…). Comma- or line-separated. Leave blank to import from everyone.
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
                    <Box>
                      <Typography component="label" sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>Period</Typography>
                      <Select value={days} onChange={(e) => setDays(e.target.value)} sx={{ width: "auto", minWidth: 150 }}>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="180">Last 6 months</option>
                        <option value="365">Last 1 year</option>
                        <option value="730">Last 2 years</option>
                      </Select>
                    </Box>
                    <Button Icon={UploadCloud} onClick={importAll} disabled={importing} sx={{ alignSelf: "flex-end" }}>
                      {importing ? "Importing… (keep this open)" : "Import all now"}
                    </Button>
                    <Button variant="secondary" Icon={Link2Off} onClick={disconnect} disabled={busy} sx={{ alignSelf: "flex-end" }}>Disconnect</Button>
                  </Box>

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
    </Box>
  );
}

// Summary of a bulk Gmail import run.
function ImportResult({ result }) {
  const c = result.counts || {};
  const chips = [
    ["Invoices", c.invoice], ["Freight statements", c.freight], ["Payments", c.payment], ["FASTag", c.fastag],
    ["Duplicates skipped", c.duplicates], ["Unrecognised", c.unrecognised], ["Failed", c.failed],
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
          <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}><b>Average</b>: km your tanker runs per litre — sets the oil given per shipment (oil = farthest RTKM ÷ average). <b>Diesel price</b>: ₹ per litre — turns the diesel you give drivers into a real cost in Spend &amp; Profit. <b>Meal allowance</b>: a flat ₹ given to the driver per trip (food/team), on top of diesel &amp; salary — applied once per shipment and added to Spend &amp; Profit.</Typography>
          <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 110 }}><Input type="number" inputProps={{ step: "0.1", min: "0.1" }} value={avg} onChange={(e) => setAvg(e.target.value)} /></Box>
            <Typography sx={{ fontSize: 14, color: "text.secondary", mr: 1 }}>km / L</Typography>
            <Box sx={{ width: 110 }}><Input type="number" inputProps={{ step: "1", min: "0" }} value={price} onChange={(e) => setPrice(e.target.value)} /></Box>
            <Typography sx={{ fontSize: 14, color: "text.secondary", mr: 1 }}>₹ / L diesel</Typography>
            <Box sx={{ width: 110 }}><Input type="number" inputProps={{ step: "50", min: "0" }} value={meal} onChange={(e) => setMeal(e.target.value)} /></Box>
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>₹ / trip meal</Typography>
            <Button onClick={save} disabled={busy || !(Number(avg) > 0)}>Save</Button>
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
