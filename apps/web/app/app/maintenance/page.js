"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Modal, Field, Input, Select, Table, Td, Tr, rupee, IconButton, useConfirm } from "@/components/ui";
import Box from "@mui/material/Box";
import { DatePicker } from "@/components/DatePicker";
import { Plus, Trash2 } from "@/components/icons";

export default function MaintenancePage() {
  const { activeId } = useApp();
  const { data: maintenanceData, mutate: mutateItems } = useApi(activeId ? `/api/maintenance?transportId=${activeId}` : null);
  const { data: trucksData } = useApi(activeId ? `/api/trucks?transportId=${activeId}` : null);
  const items = maintenanceData?.maintenance || [];
  const trucks = trucksData?.trucks || [];
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  async function save(form) {
    setBusy(true);
    try {
      await api("/api/maintenance", { method: "POST", body: { ...form, transportId: activeId } });
      setEditing(null); mutateItems();
    } finally { setBusy(false); }
  }
  async function remove(id) {
    if (!(await confirm({ title: "Delete record?", message: "This removes the maintenance record.", confirmLabel: "Delete", danger: true }))) return;
    await api(`/api/maintenance/${id}`, { method: "DELETE" }); mutateItems();
  }
  const truckName = (id) => trucks.find((t) => t.id === id)?.name || trucks.find((t) => t.id === id)?.registrationNo || "—";

  if (!activeId) return <Card>Select or create a transport first.</Card>;

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <Button Icon={Plus} onClick={() => setEditing({ truckId: "", date: "", category: "", description: "", cost: "", vendor: "", odometer: "" })}>Add record</Button>
      </Box>
      <Table head={["Date", "Truck", "Category", "Description", "Cost", ""]}>
        {items.map((m) => (
          <Tr key={m.id}>
            <Td>{new Date(m.date).toLocaleDateString("en-IN")}</Td>
            <Td>{truckName(m.truckId)}</Td>
            <Td>{m.category || "—"}</Td>
            <Td>{m.description || "—"}</Td>
            <Td>{rupee(m.cost)}</Td>
            <Td><Box sx={{ display: "flex", justifyContent: "flex-end" }}><IconButton Icon={Trash2} label="Delete" tone="rose" onClick={() => remove(m.id)} /></Box></Td>
          </Tr>
        ))}
        {items.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No maintenance records.</Td></Tr>}
      </Table>
      {ConfirmModal}
      {editing && (
        <Modal title="Add maintenance" onClose={() => setEditing(null)}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.5 }}>
            <Field label="Truck"><Select value={editing.truckId} onChange={(e) => setEditing({ ...editing, truckId: e.target.value })}><option value="">—</option>{trucks.map((t) => <option key={t.id} value={t.id}>{t.name || t.registrationNo}</option>)}</Select></Field>
            <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
            <Field label="Category"><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="tyre / engine / service" /></Field>
            <Field label="Cost (₹)"><Input type="number" value={editing.cost} onChange={(e) => setEditing({ ...editing, cost: e.target.value })} /></Field>
            <Field label="Vendor"><Input value={editing.vendor} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} /></Field>
            <Field label="Odometer"><Input type="number" value={editing.odometer} onChange={(e) => setEditing({ ...editing, odometer: e.target.value })} /></Field>
            <Field label="Description" sx={{ gridColumn: "span 2" }}><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
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
