"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Input } from "@/components/ui";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Mail, Building2, Plug, Sparkles, AlertTriangle } from "@/components/icons";

const SKIP_KEY = "rtkm_gmail_skipped";

// Onboarding + the persistent "connect Gmail" strip, both on the dashboard.
//  - brand-new owner (no transport)      → step 1: name your transport
//  - transport but Gmail not connected   → step 2: connect Gmail (skippable)
//  - skipped / later disconnected        → a compact amber strip that keeps nudging
//  - connected                           → renders nothing
export default function GmailSetup() {
  const { me, activeId, reloadTransports, switchTransport } = useApp();
  const { data: statusData, mutate: mutateStatus } = useApi(activeId ? `/api/integrations/gmail/status?transportId=${activeId}` : null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => { try { setSkipped(localStorage.getItem(SKIP_KEY) === "1"); } catch {} }, []);
  // Coming back from Google — clear the skip flag and re-read status.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("gmail") === "connected") {
      try { localStorage.removeItem(SKIP_KEY); } catch {}
      setSkipped(false); mutateStatus();
    }
  }, [mutateStatus]);

  const isOwner = me?.role === "owner";
  const connected = !!statusData?.gmail?.connected;
  const connect = () => { window.location.href = `/api/integrations/gmail/connect?transportId=${activeId}&next=/app`; };
  function skip() { try { localStorage.setItem(SKIP_KEY, "1"); } catch {} setSkipped(true); }

  async function createTransport() {
    if (name.trim().length < 2) { setErr("Enter a name for your transport."); return; }
    setBusy(true); setErr("");
    try {
      const { transport } = await api("/api/transports", { method: "POST", body: { name: name.trim() } });
      await reloadTransports();
      switchTransport(transport.id);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  // Step 1 — brand-new owner has no transport yet. Gmail can't be connected until one exists.
  if (isOwner && !activeId) {
    return (
      <Card sx={{ mb: 2, border: "1px solid", borderColor: "primary.light" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Sparkles size={18} color="#7c3aed" />
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "primary.main" }}>Step 1 of 2</Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Welcome to RTKM — name your transport</Typography>
        <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
          Everything (trucks, drivers, freight, salaries) lives under a transport. You can add more later.
        </Typography>
        <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Box sx={{ minWidth: 240 }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sadguru Kripa Transport" />
          </Box>
          <Button Icon={Building2} onClick={createTransport} disabled={busy}>{busy ? "Creating…" : "Create transport"}</Button>
        </Box>
        {err && <Typography sx={{ mt: 1, fontSize: 13, color: "error.main" }}>{err}</Typography>}
      </Card>
    );
  }

  if (!activeId || connected) return null;

  // Step 2 — transport exists, Gmail still not connected. Full card until skipped, then a strip.
  if (!skipped) {
    return (
      <Card sx={{ mb: 2, border: "1px solid", borderColor: "primary.light" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Sparkles size={18} color="#7c3aed" />
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "primary.main" }}>Step 2 of 2</Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Connect your Gmail</Typography>
        <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
          RTKM reads the mails the oil company already sends you — freight statements, tax invoices, bank advices,
          gate-in and document-expiry alerts — and files them automatically. Without it you'll have to upload every PDF by hand.
        </Typography>
        <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button Icon={Plug} onClick={connect}>Connect Gmail</Button>
          <Button variant="secondary" onClick={skip}>Skip for now</Button>
        </Box>
      </Card>
    );
  }

  return (
    <Box sx={{
      mb: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
      borderRadius: 3, px: 2, py: 1.25, bgcolor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)",
    }}>
      <AlertTriangle size={18} color="#b45309" />
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>Gmail not connected</Typography>
        <Typography sx={{ fontSize: 12.5, color: "#92400e" }}>
          Freight statements, invoices and alerts won't import automatically until you connect it.
        </Typography>
      </Box>
      <Button Icon={Mail} onClick={connect}>Connect Gmail</Button>
    </Box>
  );
}
