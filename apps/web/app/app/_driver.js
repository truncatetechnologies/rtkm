"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useApp } from "@/lib/appContext";
import { useApi } from "@/lib/useApi";
import { uploadMeterReading } from "@/lib/clientApi";
import { Card, Table, Td, Tr, Button, Badge, Tile, Modal, Field, Input, Select, rupee } from "@/components/ui";
import { InvoiceUploadModal, ShortageUploadModal } from "@/components/UploadFlow";

export function DriverHome() {
  const { me } = useApp();
  const [modal, setModal] = useState(null);

  const { data: loadsData, mutate: mutateLoads } = useApi("/api/me/loads");
  const { data: payData, mutate: mutatePay } = useApi("/api/me/payslips");
  const { data: readingData, mutate: mutateReadings } = useApi("/api/me/meter-readings");
  const loads = loadsData?.loads || [];
  const pay = payData || { payslips: [], openShortages: [], summary: {} };
  const readings = readingData?.readings || [];
  const summary = pay.summary || {};
  const refresh = () => { mutateLoads(); mutatePay(); mutateReadings(); };

  const lastSlip = pay.payslips[0];
  const pendingDeduction = summary.openShortageValue ?? pay.openShortages.reduce((s, x) => s + (x.shortageValue || 0), 0);
  const invoiceById = Object.fromEntries(loads.map((l) => [l.id, l.invoiceNumber || l.id.slice(-6)]));

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5, fontSize: 24, fontWeight: 700 }}>Hi, {me.name}</Typography>
      <Typography sx={{ mb: 2.5, fontSize: 14, color: "text.secondary" }}>Your trips, salary, shortages & meter readings</Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 2 }}>
        <Tile label="My trips" value={loads.length} />
        <Tile label="Last payslip" value={lastSlip ? rupee(lastSlip.netPay) : "—"} tone="green" />
        <Tile label="Pending salary" value={rupee(summary.pendingSalary || 0)} tone="amber" />
        <Tile label="Pending deduction" value={rupee(pendingDeduction)} tone="rose" />
      </Box>

      <Box sx={{ mt: 2.5, display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        <Button onClick={() => setModal("meter")}>📷 Add meter reading</Button>
        <Button variant="secondary" onClick={() => setModal("invoice")}>📄 Upload invoice</Button>
        <Button variant="danger" onClick={() => setModal("shortage")}>Upload shortage PDF</Button>
      </Box>

      <Typography variant="h6" sx={{ mb: 1, mt: 4, fontWeight: 600 }}>My recent trips</Typography>
      <Table head={["Date", "Invoice", "From → To", "Load (L)", "Shortage (L)"]}>
        {loads.slice(0, 20).map((l) => (
          <Tr key={l.id}>
            <Td>{new Date(l.loadDate).toLocaleDateString("en-IN")}</Td>
            <Td>{l.invoiceNumber || "—"}</Td>
            <Td>{l.fromLocation || "—"} → {l.toLocation || "—"}</Td>
            <Td>{l.loadQtyL}</Td>
            <Td>{l.shortageL ? <Badge tone="red">{l.shortageL}</Badge> : "0"}</Td>
          </Tr>
        ))}
        {loads.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No trips yet.</Td></Tr>}
      </Table>

      <Typography variant="h6" sx={{ mb: 1, mt: 4, fontWeight: 600 }}>My shortages</Typography>
      <Table head={["Reported", "Invoice", "Shortage (L)", "Cut (₹)", "Status"]}>
        {pay.openShortages.map((x) => (
          <Tr key={x.id}>
            <Td>{x.reportedAt ? new Date(x.reportedAt).toLocaleDateString("en-IN") : "—"}</Td>
            <Td>{x.invoiceNumber || "—"}</Td>
            <Td>{x.shortageL}</Td>
            <Td sx={{ fontWeight: 600 }}>{rupee(x.shortageValue)}</Td>
            <Td><Badge tone="yellow">{x.status}</Badge></Td>
          </Tr>
        ))}
        {pay.openShortages.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No open shortages.</Td></Tr>}
      </Table>

      <Typography variant="h6" sx={{ mb: 1, mt: 4, fontWeight: 600 }}>My payslips</Typography>
      <Table head={["Period", "Days paid", "Base", "Deductions", "Net", "Status"]}>
        {pay.payslips.map((p) => (
          <Tr key={p.id}>
            <Td>{p.period}</Td>
            <Td>{p.daysInMonth ? `${p.payableDays}/${p.daysInMonth}${p.leaveDays ? ` · ${p.leaveDays} leave` : ""}` : "—"}</Td>
            <Td>{rupee(p.baseSalary)}</Td>
            <Td>{rupee(p.deductions.reduce((s, d) => s + d.amount, 0))}</Td>
            <Td sx={{ fontWeight: 600 }}>{rupee(p.netPay)}</Td>
            <Td><Badge tone={p.status === "paid" ? "green" : "yellow"}>{p.status}</Badge></Td>
          </Tr>
        ))}
        {pay.payslips.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No payslips yet.</Td></Tr>}
      </Table>

      <Typography variant="h6" sx={{ mb: 1, mt: 4, fontWeight: 600 }}>My meter readings</Typography>
      <Table head={["When", "Trip", "Reading (km)", "Photo", "Notes"]}>
        {readings.map((r) => (
          <Tr key={r.id}>
            <Td>{new Date(r.recordedAt).toLocaleDateString("en-IN")}</Td>
            <Td>{invoiceById[r.loadId] || "—"}</Td>
            <Td sx={{ fontWeight: 600 }}>{r.readingKm.toLocaleString("en-IN")}</Td>
            <Td>{r.hasPhoto ? <Box component="a" href={`/api/meter-readings/${r.id}/photo`} target="_blank" rel="noreferrer" sx={{ color: "primary.main" }}>View</Box> : "—"}</Td>
            <Td sx={{ color: "text.secondary" }}>{r.notes || "—"}</Td>
          </Tr>
        ))}
        {readings.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No meter readings yet.</Td></Tr>}
      </Table>

      {modal === "meter" && <MeterReadingModal loads={loads} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "invoice" && <InvoiceUploadModal transportId={me.transportId} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "shortage" && <ShortageUploadModal transportId={me.transportId} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
    </Box>
  );
}

// Driver records the truck's odometer (count) for a trip, optionally with a photo of the meter.
function MeterReadingModal({ loads, onClose, onDone }) {
  const [loadId, setLoadId] = useState(loads[0]?.id || "");
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
      await uploadMeterReading("/api/me/meter-readings", { fields: { loadId, readingKm, notes }, photo });
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
                {(l.invoiceNumber || l.id.slice(-6))} · {new Date(l.loadDate).toLocaleDateString("en-IN")} · {l.toLocation || l.roName || "—"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Meter reading (km)"><Input type="number" inputMode="numeric" value={readingKm} onChange={(e) => setReadingKm(e.target.value)} placeholder="e.g. 145320" /></Field>
        <Field label="Photo of the meter (optional)">
          <Box component="input" type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} sx={{ fontSize: 14 }} />
        </Field>
        <Field label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="anything to add" /></Field>
      </Box>
      {err && <Typography sx={{ mt: 1.5, fontSize: 13, color: "error.main" }}>{err}</Typography>}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save reading"}</Button>
      </Box>
    </Modal>
  );
}
