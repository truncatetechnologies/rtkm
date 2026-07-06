"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useApp } from "@/lib/appContext";
import { useApi } from "@/lib/useApi";
import { uploadMeterReading } from "@/lib/clientApi";
import { Card, Button, Modal, Field, Input, Select, Table, Td, Tr, Badge, PageLoader } from "@/components/ui";
import { Plus } from "@/components/icons";

export default function MeterReadings() {
  const { activeId } = useApp();
  const { data, mutate, isLoading } = useApi(activeId ? `/api/meter-readings?transportId=${activeId}` : null);
  const { data: loadsData } = useApi(activeId ? `/api/loads?transportId=${activeId}` : null);
  const { data: driversData } = useApi(activeId ? `/api/members?transportId=${activeId}&role=driver` : null);
  const readings = data?.readings || [];
  const loads = loadsData?.loads || [];
  const drivers = driversData?.members || [];
  const [adding, setAdding] = useState(false);

  const invoiceById = Object.fromEntries(loads.map((l) => [l.id, l.invoiceNumber || l.id.slice(-6)]));
  const driverById = Object.fromEntries(drivers.map((d) => [d.id, d.name]));

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  if (isLoading && !data) return <PageLoader label="Loading meter readings…" />;

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Odometer readings drivers recorded on their trips. You can also enter one manually.</Typography>
        <Button Icon={Plus} onClick={() => setAdding(true)}>Add reading</Button>
      </Box>
      <Table head={["When", "Driver", "Trip", "Reading (km)", "Photo", "Source", "Notes"]}>
        {readings.map((r) => (
          <Tr key={r.id}>
            <Td>{new Date(r.recordedAt).toLocaleString("en-IN")}</Td>
            <Td>{driverById[r.driverId] || "—"}</Td>
            <Td>{invoiceById[r.loadId] || "—"}</Td>
            <Td sx={{ fontWeight: 600 }}>{r.readingKm.toLocaleString("en-IN")}</Td>
            <Td>{r.hasPhoto ? <Box component="a" href={`/api/meter-readings/${r.id}/photo`} target="_blank" rel="noreferrer" sx={{ color: "primary.main" }}>View</Box> : "—"}</Td>
            <Td><Badge tone={r.source === "driver" ? "indigo" : "gray"}>{r.source}</Badge></Td>
            <Td sx={{ color: "text.secondary" }}>{r.notes || "—"}</Td>
          </Tr>
        ))}
        {readings.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No meter readings yet.</Td></Tr>}
      </Table>
      {adding && <AddReadingModal transportId={activeId} loads={loads} drivers={drivers} onClose={() => setAdding(false)} onDone={() => { setAdding(false); mutate(); }} />}
    </Box>
  );
}

function AddReadingModal({ transportId, loads, drivers, onClose, onDone }) {
  const [loadId, setLoadId] = useState(loads[0]?.id || "");
  const [driverId, setDriverId] = useState("");
  const [readingKm, setReadingKm] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!loadId) { setErr("Pick a trip."); return; }
    if (!(Number(readingKm) > 0)) { setErr("Enter the meter reading."); return; }
    setBusy(true); setErr("");
    try {
      await uploadMeterReading("/api/meter-readings", { fields: { transportId, loadId, driverId, readingKm, notes }, photo });
      onDone();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  return (
    <Modal title="Add meter reading" onClose={onClose}>
      <Box sx={{ display: "grid", gap: 1.5 }}>
        <Field label="Trip">
          <Select value={loadId} onChange={(e) => setLoadId(e.target.value)}>
            {loads.length === 0 && <option value="">No trips yet</option>}
            {loads.map((l) => (
              <option key={l.id} value={l.id}>
                {(l.invoiceNumber || l.id.slice(-6))} · {new Date(l.loadDate).toLocaleDateString("en-IN")} · {l.driverName || "—"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Driver (optional — defaults to the trip's driver)">
          <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">From trip</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Meter reading (km)"><Input type="number" inputMode="numeric" value={readingKm} onChange={(e) => setReadingKm(e.target.value)} placeholder="e.g. 145320" /></Field>
        <Field label="Photo of the meter (optional)">
          <Box component="input" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} sx={{ fontSize: 14 }} />
        </Field>
        <Field label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Box>
      {err && <Typography sx={{ mt: 1.5, fontSize: 13, color: "error.main" }}>{err}</Typography>}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save reading"}</Button>
      </Box>
    </Modal>
  );
}
