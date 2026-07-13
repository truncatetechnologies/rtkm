"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { Button } from "@/components/ui";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { RefreshCw, ChevronDown } from "@/components/icons";

// "I logged in and my data isn't here" — pull straight from Gmail for a short period.
// Deliberately just three obvious choices, on every data page.
const PERIODS = [["today", "Today"], ["week", "This week"], ["month", "This month"]];

export default function SyncBar({ page, kinds, onDone, label = "Sync" }) {
  const { activeId } = useApp();
  const [period, setPeriod] = useState("week");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    if (!activeId) return;
    setBusy(true); setMsg("");
    try {
      const r = await api("/api/sync/run", {
        method: "POST",
        body: { transportId: activeId, page, kinds, period },
        timeout: 300000, retries: 0,
      });
      setMsg(r.message || "Synced.");
      await onDone?.();
    } catch (e) {
      setMsg(`Sync failed: ${e.message || e}`);
    } finally { setBusy(false); }
  }

  if (!activeId) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {msg && <Typography sx={{ fontSize: 12.5, color: "text.secondary", maxWidth: 320 }}>{msg}</Typography>}
      <Box sx={{ position: "relative" }}>
        <Box component="select" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={busy}
          aria-label="Sync period"
          sx={{
            appearance: "none", borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "rgba(255,255,255,0.7)",
            py: 1, pl: 1.5, pr: 4, fontSize: 14, fontWeight: 600, color: "text.secondary", outline: "none",
            "&:focus": { borderColor: "primary.light" },
          }}>
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Box>
        <Box component={ChevronDown} size={16} sx={{ pointerEvents: "none", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "text.disabled" }} />
      </Box>
      <Button variant="secondary" Icon={RefreshCw} onClick={run} disabled={busy}>{busy ? "Syncing…" : label}</Button>
    </Box>
  );
}
