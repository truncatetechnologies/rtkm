"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Modal, Field, Input, Table, Td, Tr, Badge, rupee, IconButton, useConfirm, PageLoader } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Plus, Pencil, Trash2 } from "@/components/icons";

export default function Drivers() {
  const { activeId, me } = useApp();
  const { data: driversData, mutate: mutateDrivers, isLoading } = useApi(activeId ? `/api/members?transportId=${activeId}&role=driver` : null);
  const drivers = driversData?.members || [];
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const isOwner = me.role === "owner";
  const { confirm, ConfirmModal } = useConfirm();

  async function save(form) {
    setBusy(true);
    try {
      const body = { ...form, transportId: activeId, role: "driver" };
      if (form.id) await api(`/api/members/${form.id}`, { method: "PUT", body });
      else await api("/api/members", { method: "POST", body });
      setEditing(null); mutateDrivers();
    } catch (e) { alert(String(e.message || e)); } finally { setBusy(false); }
  }
  async function remove(id) {
    if (!(await confirm({ title: "Remove driver?", message: "This removes the driver's login and record.", confirmLabel: "Remove", danger: true }))) return;
    await api(`/api/members/${id}`, { method: "DELETE" }); mutateDrivers();
  }
  async function toggleAccess(d) {
    await api(`/api/members/${d.id}`, { method: "PUT", body: { appAccessEnabled: !d.appAccessEnabled } });
    mutateDrivers();
  }

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  if (isLoading && !driversData) return <PageLoader label="Loading drivers…" />;

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <Button Icon={Plus} onClick={() => setEditing({ name: "", phone: "", pin: "", baseSalary: "", shortageRatePerUnit: "", licenseNo: "", joiningDate: "", appAccessEnabled: false })}>Add driver</Button>
      </Box>
      <Table head={["Name", "Phone", "Base salary", "Shortage rate", "App login", "Status", ""]}>
        {drivers.map((d) => (
          <Tr key={d.id}>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{d.name}</Td>
            <Td>{d.phone}</Td>
            <Td>{rupee(d.baseSalary)}</Td>
            <Td>₹{d.shortageRatePerUnit}/L</Td>
            <Td>
              <Box component="button" onClick={() => toggleAccess(d)} title="Allow this driver to log into the app/web"
                sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", p: 0 }}>
                <Badge tone={d.appAccessEnabled ? "green" : "gray"}>{d.appAccessEnabled ? "Enabled" : "Off"}</Badge>
              </Box>
            </Td>
            <Td><Badge tone={d.status === "active" ? "green" : "red"}>{d.status}</Badge></Td>
            <Td>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <IconButton Icon={Pencil} label="Edit" tone="indigo" onClick={() => setEditing({ ...d, pin: "", joiningDate: d.joiningDate ? String(d.joiningDate).slice(0, 10) : "" })} />
                <IconButton Icon={Trash2} label="Delete" tone="rose" onClick={() => remove(d.id)} />
              </Box>
            </Td>
          </Tr>
        ))}
        {drivers.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No drivers yet.</Td></Tr>}
      </Table>
      {editing && <DriverModal initial={editing} isOwner={isOwner} busy={busy} onCancel={() => setEditing(null)} onSave={save} />}
      {ConfirmModal}
    </Box>
  );
}

function DriverModal({ initial, isOwner, onCancel, onSave, busy }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={f.id ? "Edit driver" : "Add driver"} onClose={onCancel}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.5 }}>
        <Field label="Name"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set("phone")} disabled={!!f.id} /></Field>
        <Field label={f.id ? "New PIN (optional)" : "PIN (4–6 digits)"}><Input value={f.pin} onChange={set("pin")} /></Field>
        <Field label="License No."><Input value={f.licenseNo} onChange={set("licenseNo")} /></Field>
        <Field label="Joining date"><DatePicker value={f.joiningDate || ""} onChange={(v) => setF({ ...f, joiningDate: v })} placeholder="Joining date" /></Field>
        <Field label="Base salary (₹/month)"><Input type="number" value={f.baseSalary} onChange={set("baseSalary")} disabled={!isOwner} /></Field>
        <Field label="Shortage deduction (₹ per L)"><Input type="number" value={f.shortageRatePerUnit} onChange={set("shortageRatePerUnit")} disabled={!isOwner} /></Field>
      </Box>
      <Box component="label" sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1, cursor: "pointer", fontSize: 14, color: "text.primary" }}>
        <Box component="input" type="checkbox" checked={!!f.appAccessEnabled} onChange={(e) => setF({ ...f, appAccessEnabled: e.target.checked })} sx={{ width: 16, height: 16 }} />
        Allow app / web login — the driver can sign in to see their trips, salary & shortages and upload meter readings.
      </Box>
      {!isOwner && <Typography sx={{ mt: 1, fontSize: 12, color: "text.disabled" }}>Only the owner can set salary fields.</Typography>}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(f)} disabled={busy}>Save</Button>
      </Box>
    </Modal>
  );
}
