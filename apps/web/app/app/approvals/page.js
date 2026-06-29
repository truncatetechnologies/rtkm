"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/clientApi";
import { Card, Table, Td, Tr, Badge, Button } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { Gauge } from "@/components/icons";

export default function Approvals() {
  const [status, setStatus] = useState("pending");
  const { data, mutate } = useApi(`/api/admin/rtkm-requests?status=${status}`);
  const rows = data?.requests || [];
  const [busy, setBusy] = useState("");

  async function decide(id, action) {
    setBusy(id);
    try { await api(`/api/admin/rtkm-requests/${id}`, { method: "POST", body: { action } }); mutate(); }
    finally { setBusy(""); }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Card sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2 }}>
        <Box sx={{ display: "flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 2.5, color: "#fff", backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}><Gauge size={20} /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: "text.primary" }}>RTKM master approvals</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>When an uploaded PDF&apos;s RTKM differs from the master, it waits here. Approve to update the master pump RTKM; reject to keep the current value.</Typography>
        </Box>
      </Card>

      <Box sx={{ display: "flex", gap: 1 }}>
        {[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]].map(([k, label]) => (
          <Button key={k} variant="ghost" onClick={() => setStatus(k)} className={status === k ? undefined : "glass"}
            sx={{ borderRadius: 999, px: 2, py: 0.75, fontSize: 14, fontWeight: 600, ...(status === k ? { bgcolor: "#4f46e5", color: "#fff" } : { color: "text.secondary" }) }}>
            {label}{k === "pending" && data?.pending ? ` (${data.pending})` : ""}
          </Button>
        ))}
      </Box>

      <Table head={["Pump", "Name", "Current RTKM", "New RTKM (PDF)", "Source", "Status", ""]}>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td sx={{ fontWeight: 600, color: "text.primary" }}>{r.cmsCode}</Td>
            <Td sx={{ color: "text.secondary" }}>{r.roName || "—"}</Td>
            <Td>{r.currentRtkm}</Td>
            <Td sx={{ fontWeight: 700, color: "#2563eb" }}>{r.proposedRtkm}</Td>
            <Td sx={{ color: "text.secondary" }}>{r.source}{r.invoiceNumber ? ` · ${r.invoiceNumber}` : ""}</Td>
            <Td><Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "gray" : "yellow"}>{r.status}</Badge></Td>
            <Td>
              {r.status === "pending" ? (
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                  <Button size="sm" onClick={() => decide(r.id, "approve")} disabled={busy === r.id} sx={{ px: 1.5, py: 0.5, fontSize: 13 }}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => decide(r.id, "reject")} disabled={busy === r.id} sx={{ px: 1.5, py: 0.5, fontSize: 13 }}>Reject</Button>
                </Box>
              ) : null}
            </Td>
          </Tr>
        ))}
        {rows.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No {status === "all" ? "" : status} requests.</Td></Tr>}
      </Table>
    </Box>
  );
}
