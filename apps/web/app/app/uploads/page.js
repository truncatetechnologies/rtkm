"use client";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Table, Td, Tr, Badge, IconButton, useConfirm } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { Undo2, FileText, FileSpreadsheet, Landmark } from "@/components/icons";

const KIND = {
  invoice: { label: "Invoice", Icon: FileText, tone: "blue" },
  freight: { label: "Statement of Freight", Icon: FileSpreadsheet, tone: "green" },
  payment: { label: "Bank Payment Advice", Icon: Landmark, tone: "blue" },
};

export default function Uploads() {
  const { activeId } = useApp();
  const { mutate } = useSWRConfig();
  const { data: uploadsData } = useApi(activeId ? `/api/uploads?transportId=${activeId}` : null);
  const rows = uploadsData?.uploads || [];
  const [msg, setMsg] = useState("");
  const { confirm, ConfirmModal } = useConfirm();

  if (!activeId) return <Card>Select or create a transport first.</Card>;

  async function undo(u) {
    const ok = await confirm({
      title: "Undo this upload?",
      message: `This will remove everything this ${KIND[u.kind]?.label || "upload"} created${u.affectedCount ? " and un-settle the deliveries it settled" : ""}. This cannot be undone.`,
      confirmLabel: "Undo upload", danger: true,
    });
    if (!ok) return;
    const r = await api(`/api/uploads/${u.id}/revert`, { method: "POST" });
    setMsg(`Reverted — ${r.deletedLoads || 0} deliveries removed, ${r.deletedShortages || 0} shortages removed, ${r.unsettled || 0} un-settled.`);
    // Revalidate EVERY cached endpoint so ledger / loads / overview / reports reflect the undo
    // immediately (SWR caches in localStorage with a 60s dedupe, so the local list alone isn't enough).
    await mutate(() => true);
  }

  return (
    <Box>
      <Typography sx={{ mb: 2, fontSize: 14, color: "text.secondary" }}>Every PDF you upload is listed here. <b>Undo</b> reverts exactly what that upload changed — handy if a wrong document was uploaded.</Typography>
      {msg && <Typography sx={{ mb: 1.5, borderRadius: 3, bgcolor: "rgba(16,185,129,0.08)", px: 2, py: 1, fontSize: 14, color: "success.main" }}>{msg}</Typography>}

      <Table head={["When", "Type", "What it did", "Status", ""]}>
        {rows.map((u) => {
          const k = KIND[u.kind] || { label: u.kind || "—", Icon: FileText };
          return (
            <Tr key={u.id}>
              <Td>{new Date(u.createdAt).toLocaleString("en-IN")}</Td>
              <Td><Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontWeight: 500, color: "text.primary" }}><k.Icon size={16} color="#94a3b8" />{k.label}</Box></Td>
              <Td sx={{ color: "text.secondary" }}>{u.summary || "—"}{u.filename ? <Typography component="span" sx={{ display: "block", fontSize: 12, color: "text.disabled" }}>{u.filename}</Typography> : null}</Td>
              <Td>{u.reverted ? <Badge tone="gray">reverted</Badge> : <Badge tone="green">active</Badge>}</Td>
              <Td><Box sx={{ display: "flex", justifyContent: "flex-end" }}>{!u.reverted && <IconButton Icon={Undo2} label="Undo" tone="rose" onClick={() => undo(u)} />}</Box></Td>
            </Tr>
          );
        })}
        {rows.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No uploads yet.</Td></Tr>}
      </Table>
      {ConfirmModal}
    </Box>
  );
}
