"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Table, Td, Tr, Badge, Tile, Button, Select, PageLoader, SkeletonPage } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { Warehouse, Truck, Mail, CheckCircle2 } from "@/components/icons";

const COMPANY = { nayara: "Nayara", bpcl: "BPCL", hpcl: "HPCL", ioc: "IndianOil" };
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export default function GateInPage() {
  const { activeId } = useApp();
  const { data, mutate, isLoading } = useApi(activeId ? `/api/gate-in?transportId=${activeId}` : null);
  const [days, setDays] = useState("365");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  if (isLoading && !data) return <SkeletonPage tiles={3} cols={5} />;

  async function sync() {
    setBusy(true); setMsg("");
    try {
      const r = await api("/api/gate-in/sync", { method: "POST", body: { transportId: activeId, days: Number(days) }, timeout: 300000, retries: 0 });
      setMsg(`Synced — scanned ${r.scanned} email(s), ${r.created} new gate event(s) added.`);
      mutate();
    } catch (e) { setMsg(String(e.message || e)); }
    finally { setBusy(false); }
  }

  const rows = data?.rows || [];
  const tankers = new Set(rows.map((r) => r.vehicleNo).filter(Boolean)).size;
  const depots = data?.byDepot || [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Card>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box component="span" sx={{ display: "flex", height: 48, width: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(37,99,235,0.08)" }}><Warehouse size={24} color="#2563eb" /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Depot Gate In</Typography>
            <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>Every time a tanker enters a depot, the oil company emails a "Gate In" notification. This pulls those emails from your connected Gmail so you can see which tanker entered which depot, and when.</Typography>
            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
              <Select value={days} onChange={(e) => setDays(e.target.value)} sx={{ width: "auto", minWidth: 150 }}>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 1 year</option>
                <option value="730">Last 2 years</option>
              </Select>
              <Button Icon={Mail} onClick={sync} disabled={busy}>{busy ? "Syncing…" : "Sync from Gmail"}</Button>
            </Box>
            {msg && <Typography sx={{ mt: 1.5, fontSize: 13.5, fontWeight: 500, color: "primary.dark", display: "flex", alignItems: "center", gap: 0.75 }}><CheckCircle2 size={16} /> {msg}</Typography>}
            <Typography sx={{ mt: 1.5, fontSize: 12, color: "text.disabled" }}>Not connected to Gmail? Go to <b style={{ color: "#64748b" }}>Settings → Connect Gmail</b> first.</Typography>
          </Box>
        </Box>
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)" }, gap: 1.5 }}>
        <Tile label="Gate-in events" value={data?.total || 0} Icon={Warehouse} tone="blue" />
        <Tile label="Tankers" value={tankers} Icon={Truck} tone="indigo" />
        <Tile label="Depots" value={depots.length} Icon={Warehouse} tone="green" />
      </Box>

      {depots.length > 0 && (
        <>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>By depot</Typography>
          <Table head={["Depot", "Entries"]}>
            {depots.map((d) => (
              <Tr key={d.depot}><Td sx={{ color: "text.primary" }}>{d.depot}</Td><Td sx={{ fontWeight: 600 }}>{d.count}</Td></Tr>
            ))}
          </Table>
        </>
      )}

      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary", mt: 1 }}>Gate events</Typography>
      <Table head={["Date & time", "Tanker (TT)", "Depot", "Company", "Type"]}>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td>{fmtDateTime(r.gateAt)}</Td>
            <Td sx={{ fontWeight: 600, color: "text.primary" }}>{r.vehicleNo || "—"}</Td>
            <Td>{r.depot || "—"}</Td>
            <Td>{COMPANY[r.company] || r.company || "—"}</Td>
            <Td><Badge tone={r.direction === "out" ? "yellow" : "green"}>{r.direction === "out" ? "Gate Out" : "Gate In"}</Badge></Td>
          </Tr>
        ))}
        {rows.length === 0 && <Tr><Td colSpan={5} sx={{ color: "text.disabled", py: 3, textAlign: "center" }}>{isLoading ? "Loading…" : "No gate events yet — tap \"Sync from Gmail\"."}</Td></Tr>}
      </Table>
    </Box>
  );
}
