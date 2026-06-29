"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Modal, Field, Input, Select, Badge, IconButton, useConfirm } from "@/components/ui";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Plus, Pencil, Trash2 } from "@/components/icons";

const EMPTY = { type: "tanker", name: "", registrationNo: "", capacity: "", averageKmL: 4, assignedDriverId: "" };

export default function Trucks() {
  const { activeId } = useApp();
  const { data: trucksData, mutate: mutateTrucks } = useApi(activeId ? `/api/trucks?transportId=${activeId}` : null);
  const { data: driversData } = useApi(activeId ? `/api/members?transportId=${activeId}&role=driver` : null);
  const trucks = trucksData?.trucks || [];
  const drivers = driversData?.members || [];
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  async function save(form) {
    setBusy(true);
    try {
      const body = { ...form, transportId: activeId, assignedDriverId: form.assignedDriverId || null };
      if (form.id) await api(`/api/trucks/${form.id}`, { method: "PUT", body });
      else await api("/api/trucks", { method: "POST", body });
      setEditing(null); mutateTrucks();
    } finally { setBusy(false); }
  }
  async function remove(id) {
    if (!(await confirm({ title: "Delete truck?", message: "This permanently removes the truck.", confirmLabel: "Delete", danger: true }))) return;
    await api(`/api/trucks/${id}`, { method: "DELETE" }); mutateTrucks();
  }
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";

  if (!activeId) return <Card>Select or create a transport first.</Card>;

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <Button Icon={Plus} onClick={() => setEditing({ ...EMPTY })}>Add truck</Button>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(3,1fr)" } }}>
        {trucks.map((t) => (
          <Card key={t.id} className="animate-rise">
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>{t.name || t.registrationNo}</Box>
              <Badge tone={t.type === "tanker" ? "blue" : "gray"}>{t.type}</Badge>
            </Box>
            <Box sx={{ fontSize: 14, color: "text.secondary" }}>{t.registrationNo}</Box>
            <Box sx={{ mt: 1, fontSize: 14, color: "text.secondary" }}>Mileage: <b>{t.averageKmL}</b> km/L</Box>
            <Box sx={{ fontSize: 14, color: "text.secondary" }}>Driver: {driverName(t.assignedDriverId)}</Box>
            <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
              <IconButton Icon={Pencil} label="Edit" tone="indigo" onClick={() => setEditing({ ...t, assignedDriverId: t.assignedDriverId || "" })} />
              <IconButton Icon={Trash2} label="Delete" tone="rose" onClick={() => remove(t.id)} />
            </Box>
          </Card>
        ))}
        {trucks.length === 0 && <Typography sx={{ color: "text.disabled" }}>No trucks yet.</Typography>}
      </Box>
      {ConfirmModal}
      {editing && (
        <TruckModal initial={editing} drivers={drivers} busy={busy} onCancel={() => setEditing(null)} onSave={save} />
      )}
    </Box>
  );
}

function TruckModal({ initial, drivers, onCancel, onSave, busy }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={f.id ? "Edit truck" : "Add truck"} onClose={onCancel}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.5 }}>
        <Field label="Type"><Select value={f.type} onChange={set("type")}><option value="tanker">Tanker</option><option value="truck">Truck</option></Select></Field>
        <Field label="Name"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Registration No."><Input value={f.registrationNo} onChange={set("registrationNo")} /></Field>
        <Field label="Mileage (km/L)"><Input type="number" step="0.5" value={f.averageKmL} onChange={set("averageKmL")} /></Field>
        <Field label="Capacity (L)"><Input type="number" value={f.capacity} onChange={set("capacity")} /></Field>
        <Field label="Assigned driver"><Select value={f.assignedDriverId} onChange={set("assignedDriverId")}><option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
      </Box>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(f)} disabled={busy}>Save</Button>
      </Box>
    </Modal>
  );
}
