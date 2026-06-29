"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Modal, Field, Input, Table, Td, Tr, Badge, IconButton, useConfirm } from "@/components/ui";
import { Box } from "@mui/material";
import { Plus, Trash2 } from "@/components/icons";

export default function Managers() {
  const { activeId } = useApp();
  const { data: managersData, mutate: mutateManagers } = useApi(activeId ? `/api/members?transportId=${activeId}&role=manager` : null);
  const managers = managersData?.members || [];
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  async function save(form) {
    setBusy(true);
    try {
      await api("/api/members", { method: "POST", body: { ...form, transportId: activeId, role: "manager" } });
      setEditing(null); mutateManagers();
    } catch (e) { alert(String(e.message || e)); } finally { setBusy(false); }
  }
  async function remove(id) {
    if (!(await confirm({ title: "Remove manager?", message: "This removes the manager's access.", confirmLabel: "Remove", danger: true }))) return;
    await api(`/api/members/${id}`, { method: "DELETE" }); mutateManagers();
  }

  if (!activeId) return <Card>Select or create a transport first.</Card>;

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <Button Icon={Plus} onClick={() => setEditing({ name: "", phone: "", pin: "" })}>Add manager</Button>
      </Box>
      <Table head={["Name", "Phone", "Status", ""]}>
        {managers.map((m) => (
          <Tr key={m.id}>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{m.name}</Td>
            <Td>{m.phone}</Td>
            <Td><Badge tone={m.status === "active" ? "green" : "red"}>{m.status}</Badge></Td>
            <Td><Box sx={{ display: "flex", justifyContent: "flex-end" }}><IconButton Icon={Trash2} label="Delete" tone="rose" onClick={() => remove(m.id)} /></Box></Td>
          </Tr>
        ))}
        {managers.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No managers yet.</Td></Tr>}
      </Table>
      {ConfirmModal}
      {editing && (
        <Modal title="Add manager" onClose={() => setEditing(null)}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label="PIN (4–6 digits)"><Input value={editing.pin} onChange={(e) => setEditing({ ...editing, pin: e.target.value })} /></Field>
          </Box>
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save(editing)} disabled={busy}>Save</Button>
          </Box>
        </Modal>
      )}
    </Box>
  );
}
