"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { Card, Button, Modal, Field, Input, IconButton, useConfirm } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { Plus, Pencil, Trash2, CheckCircle2 } from "@/components/icons";

export default function Transports() {
  const { transports, reloadTransports, switchTransport } = useApp();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  async function save(form) {
    setBusy(true);
    try {
      if (form.id) await api(`/api/transports/${form.id}`, { method: "PUT", body: form });
      else { const r = await api("/api/transports", { method: "POST", body: form }); switchTransport(r.transport.id); }
      setEditing(null); await reloadTransports();
    } finally { setBusy(false); }
  }
  async function remove(id) {
    if (!(await confirm({ title: "Delete transport?", message: "This permanently removes the transport and can't be undone.", confirmLabel: "Delete", danger: true }))) return;
    await api(`/api/transports/${id}`, { method: "DELETE" }); await reloadTransports();
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <Button Icon={Plus} onClick={() => setEditing({ name: "", address: "", gstNo: "", phone: "" })}>Add transport</Button>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { sm: "repeat(2,1fr)", lg: "repeat(3,1fr)" } }}>
        {transports.map((t) => (
          <Card key={t.id} className="animate-rise">
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>{t.name}</Typography>
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>{t.address || "—"}</Typography>
            {t.gstNo ? <Typography sx={{ mt: 0.5, fontSize: 12, color: "text.disabled" }}>GST: {t.gstNo}</Typography> : null}
            <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
              <IconButton Icon={CheckCircle2} label="Use" tone="emerald" onClick={() => switchTransport(t.id)} />
              <IconButton Icon={Pencil} label="Edit" tone="indigo" onClick={() => setEditing(t)} />
              <IconButton Icon={Trash2} label="Delete" tone="rose" onClick={() => remove(t.id)} />
            </Box>
          </Card>
        ))}
        {transports.length === 0 && <Typography sx={{ color: "text.disabled" }}>No transports yet. Add your first fleet.</Typography>}
      </Box>
      {editing && <TransportModal initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} />}
      {ConfirmModal}
    </Box>
  );
}

function TransportModal({ initial, onCancel, onSave, busy }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={f.id ? "Edit transport" : "Add transport"} onClose={onCancel}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Field label="Name"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Address"><Input value={f.address} onChange={set("address")} /></Field>
        <Field label="GST No."><Input value={f.gstNo} onChange={set("gstNo")} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
      </Box>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(f)} disabled={busy}>Save</Button>
      </Box>
    </Modal>
  );
}
