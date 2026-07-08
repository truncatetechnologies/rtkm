"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Table, Td, Tr, Badge, rupee, IconButton, useConfirm, PageLoader, SkeletonPage } from "@/components/ui";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { FileWarning, Ban, Mail } from "@/components/icons";
import { ShortageUploadModal } from "@/components/UploadFlow";

export default function Shortages() {
  const { activeId, me } = useApp();
  const { data: shortagesData, mutate: mutateItems, isLoading } = useApi(activeId ? `/api/shortages?transportId=${activeId}` : null);
  const { data: driversData, mutate: mutateDrivers } = useApi(activeId ? `/api/members?transportId=${activeId}&role=driver` : null);
  const items = shortagesData?.shortages || [];
  const drivers = driversData?.members || [];
  const [upload, setUpload] = useState(false);
  const [view, setView] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const isOwner = me.role === "owner";
  const { confirm, ConfirmModal } = useConfirm();
  const refresh = () => { mutateItems(); mutateDrivers(); };

  async function syncFromEmail() {
    setSyncing(true); setSyncMsg("");
    try {
      const r = await api("/api/deliveries/sync", { method: "POST", body: { transportId: activeId, days: 365 }, timeout: 300000, retries: 0 });
      setSyncMsg(`Scanned ${r.scanned} email(s) — ${r.shortagesCreated} new shortage(s) recorded.`);
      refresh();
    } catch (e) { setSyncMsg(String(e.message || e)); }
    finally { setSyncing(false); }
  }

  async function waive(id) {
    if (!(await confirm({ title: "Waive shortage?", message: "No salary deduction will be applied for this shortage.", confirmLabel: "Waive" }))) return;
    await api(`/api/shortages/${id}/waive`, { method: "POST" }); refresh();
  }
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";
  const tone = (s) => (s === "open" ? "yellow" : s === "deducted" ? "green" : "gray");
  const label = (s) => (s === "open" ? "Pending" : s === "deducted" ? "Deducted" : "Waived");
  const monthName = (m) => { if (!m) return "—"; const [y, mo] = m.split("-"); return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }); };

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  if (isLoading && !shortagesData) return <SkeletonPage cols={6} />;

  const pendingAmt = items.filter((s) => s.status === "open").reduce((a, s) => a + (s.shortageValue || 0), 0);
  const deductedAmt = items.filter((s) => s.status === "deducted").reduce((a, s) => a + (s.shortageValue || 0), 0);
  const shown = items.filter((s) => view === "all" || (view === "pending" ? s.status === "open" : s.status === view));

  return (
    <Box>
      <Box sx={{ mb: 2, borderRadius: 3, bgcolor: "rgba(79,70,229,0.08)", px: 2, py: 1.5, fontSize: 14, color: "#4338ca" }}>
        Per-driver shortage cuts. The monthly <b>Statement Of Freight</b> PDF is the backup, but Nayara also emails a <b>delivery confirmation</b> within days of each trip — <b>Sync from email</b> captures those shortages early so salary is deducted on time. Each is tracked as <b>Pending</b> or <b>Deducted</b> (with the payslip month).
      </Box>
      {isOwner && (
        <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
          <Button Icon={Mail} onClick={syncFromEmail} disabled={syncing}>{syncing ? "Syncing…" : "Sync from email"}</Button>
          {syncMsg && <Typography sx={{ fontSize: 13.5, color: "primary.dark" }}>{syncMsg}</Typography>}
          <Typography sx={{ fontSize: 12, color: "text.disabled", ml: { sm: "auto" } }}>Reads Nayara delivery-confirmation emails (needs Gmail connected).</Typography>
        </Box>
      )}
      <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        {[["all", "All"], ["pending", "Pending"], ["deducted", "Deducted"], ["waived", "Waived"]].map(([k, lbl]) => (
          <Button key={k} variant="ghost" onClick={() => setView(k)} className={view === k ? undefined : "glass"}
            sx={{ borderRadius: 999, px: 2, py: 0.6, fontSize: 14, fontWeight: 600, ...(view === k ? { bgcolor: "#4f46e5", color: "#fff" } : { color: "text.secondary" }) }}>{lbl}</Button>
        ))}
        <Box sx={{ ml: "auto", display: "flex", gap: 2, fontSize: 13 }}>
          <Box component="span" sx={{ color: "#b45309", fontWeight: 600 }}>Pending: {rupee(pendingAmt)}</Box>
          <Box component="span" sx={{ color: "#059669", fontWeight: 600 }}>Deducted: {rupee(deductedAmt)}</Box>
        </Box>
      </Box>
      <Table head={["Reported", "Invoice", "Driver", "Shortage", "Deduction", "Status", "Deducted in", ""]}>
        {shown.map((s) => (
          <Tr key={s.id}>
            <Td>{new Date(s.reportedAt).toLocaleDateString("en-IN")}</Td>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{s.invoiceNumber}</Td>
            <Td>{driverName(s.driverId)}</Td>
            <Td>{s.shortageL} L</Td>
            <Td sx={{ fontWeight: 600 }}>{rupee(s.shortageValue)}</Td>
            <Td><Badge tone={tone(s.status)}>{label(s.status)}</Badge></Td>
            <Td sx={{ color: "text.secondary", fontSize: 13 }}>
              {s.status === "deducted"
                ? <>{monthName(s.deductedPeriod)} {s.deductedPaid ? <Box component="span" sx={{ color: "success.main", fontWeight: 600 }}>· paid</Box> : <Box component="span" sx={{ color: "warning.main" }}>· in draft</Box>}</>
                : "—"}
            </Td>
            <Td><Box sx={{ display: "flex", justifyContent: "flex-end" }}>{isOwner && s.status === "open" && <IconButton Icon={Ban} label="Waive" tone="slate" onClick={() => waive(s.id)} />}</Box></Td>
          </Tr>
        ))}
        {shown.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No shortages.</Td></Tr>}
      </Table>
      {upload && <ShortageUploadModal transportId={activeId} onClose={() => setUpload(false)} onDone={() => { setUpload(false); refresh(); }} />}
      {ConfirmModal}
    </Box>
  );
}
