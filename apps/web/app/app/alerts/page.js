"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Table, Td, Tr, Badge, Tile, Button, Select, PageLoader, SkeletonPage } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { AlertBell, AlertTriangle } from "@/components/icons";
import SyncBar from "@/components/SyncBar";

const COMPANY = { nayara: "Nayara", bpcl: "BPCL", hpcl: "HPCL", ioc: "IndianOil" };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const daysLeft = (d) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);

function statusChip(d) {
  const n = daysLeft(d);
  if (n === null) return <Badge tone="gray">—</Badge>;
  if (n < 0) return <Badge tone="red">Expired {Math.abs(n)}d ago</Badge>;
  if (n <= 15) return <Badge tone="yellow">{n} day{n === 1 ? "" : "s"} left</Badge>;
  return <Badge tone="green">{n} days left</Badge>;
}

export default function AlertsPage() {
  const { activeId } = useApp();
  const { data, mutate, isLoading } = useApi(activeId ? `/api/vehicle-alerts?transportId=${activeId}` : null);

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  if (isLoading && !data) return <SkeletonPage tiles={3} cols={5} />;

  const rows = data?.rows || [];
  const expiringSoon = rows.filter((r) => { const n = daysLeft(r.expiryDate); return n !== null && n >= 0 && n <= 15; }).length;
  const expired = rows.filter((r) => { const n = daysLeft(r.expiryDate); return n !== null && n < 0; }).length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Card>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box component="span" sx={{ display: "flex", height: 48, width: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(245,158,11,0.1)" }}><AlertBell size={24} color="#d97706" /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Vehicle document alerts</Typography>
            <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>Nayara (and other depots) email you when a tanker's certificate — permit, fitness, insurance, PUC — is about to expire. If it lapses, the tanker is blocked for loading. This pulls those alerts from your Gmail so you renew in time. You also get a phone notification the moment such a mail arrives.</Typography>
            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
              <SyncBar page="alerts" onDone={mutate} label="Sync from Gmail" />
            </Box>
            <Typography sx={{ mt: 1.5, fontSize: 12, color: "text.disabled" }}>Need a bigger backfill? Use <b style={{ color: "#64748b" }}>Settings → Import all</b>. Not connected to Gmail? <b style={{ color: "#64748b" }}>Settings → Connect Gmail</b>.</Typography>
          </Box>
        </Box>
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)" }, gap: 1.5 }}>
        <Tile label="Total alerts" value={data?.total || 0} Icon={AlertBell} tone="blue" />
        <Tile label="Expiring ≤ 15 days" value={expiringSoon} Icon={AlertTriangle} tone="amber" />
        <Tile label="Expired" value={expired} Icon={AlertTriangle} tone="rose" />
      </Box>

      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>Document expiries</Typography>
      <Table head={["Tanker", "Certificate", "Expiry date", "Status", "Company"]}>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td sx={{ fontWeight: 600, color: "text.primary" }}>{r.vehicleNo || "—"}</Td>
            <Td>{r.certificate || "—"}</Td>
            <Td>{fmtDate(r.expiryDate)}</Td>
            <Td>{statusChip(r.expiryDate)}</Td>
            <Td>{COMPANY[r.company] || r.company || "—"}</Td>
          </Tr>
        ))}
        {rows.length === 0 && <Tr><Td colSpan={5} sx={{ color: "text.disabled", py: 3, textAlign: "center" }}>{isLoading ? "Loading…" : "No alerts yet — tap \"Sync from Gmail\"."}</Td></Tr>}
      </Table>
    </Box>
  );
}
