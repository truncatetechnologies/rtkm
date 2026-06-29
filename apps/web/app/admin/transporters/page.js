"use client";
import { useCallback, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { Card, Table, Td, Tr, Badge, Tile, Button, rupee } from "@/components/ui";
import { MonthPicker } from "@/components/DatePicker";
import { Truck, Users, Package, Gauge, Wallet, ChevronRight } from "@/components/icons";
import { useAdminGate } from "@/lib/useAdminGate";

const km = (n) => `${Math.round(n || 0).toLocaleString("en-IN")} km`;
const L = (n) => `${Math.round(n || 0).toLocaleString("en-IN")} L`;

export default function AdminTransporters() {
  const { loading, isAdmin } = useAdminGate();
  const [selected, setSelected] = useState(null); // transport id

  if (loading) return <Card>Checking access…</Card>;
  if (!isAdmin) return <Card>Admin access required.</Card>;
  return selected
    ? <TransporterDetail id={selected} onBack={() => setSelected(null)} />
    : <TransporterList onOpen={setSelected} />;
}

function TransporterList({ onOpen }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    fetch("/api/admin/transports").then((r) => (r.ok ? r.json() : { transports: [] })).then((d) => setRows(d.transports || []));
  }, []);
  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: "text.primary", mb: 0.5 }}>Transporters</Typography>
      <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>View-only overview of every transporter on the platform. Open one to see per-tanker km &amp; loads and driver salaries by month.</Typography>
      <Table head={["Transporter", "Owner", "Trucks", "Tankers", "Drivers", "Loads", ""]}>
        {(rows || []).map((t) => (
          <Tr key={t.id} sx={{ cursor: "pointer" }} onClick={() => onOpen(t.id)}>
            <Td sx={{ fontWeight: 600, color: "text.primary" }}>{t.name}{!t.active && <Badge tone="gray" sx={{ ml: 1 }}>inactive</Badge>}</Td>
            <Td sx={{ color: "text.secondary" }}>{t.ownerName}{t.ownerPhone ? ` · ${t.ownerPhone}` : ""}</Td>
            <Td>{t.trucks}</Td>
            <Td>{t.tankers}</Td>
            <Td>{t.drivers}</Td>
            <Td>{t.loads}</Td>
            <Td><Box sx={{ display: "flex", justifyContent: "flex-end", color: "text.disabled" }}><ChevronRight size={18} /></Box></Td>
          </Tr>
        ))}
        {rows && rows.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No transporters yet.</Td></Tr>}
        {!rows && <Tr><Td sx={{ color: "text.disabled" }}>Loading…</Td></Tr>}
      </Table>
    </Box>
  );
}

function TransporterDetail({ id, onBack }) {
  const [period, setPeriod] = useState("");
  const [d, setD] = useState(null);
  const load = useCallback(() => {
    const q = period ? `?period=${period}` : "";
    fetch(`/api/admin/transports/${id}${q}`).then((r) => (r.ok ? r.json() : null)).then((data) => {
      if (data) { setD(data); if (!period && data.period) setPeriod(data.period); }
    });
  }, [id, period]);
  useEffect(() => { load(); }, [load]);

  if (!d) return <Card>Loading…</Card>;
  const t = d.totals;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        <Button variant="secondary" size="sm" onClick={onBack}>← All transporters</Button>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "text.primary", lineHeight: 1.1 }}>{d.transport.name}</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Owner: {d.transport.ownerName}{d.transport.ownerPhone ? ` · ${d.transport.ownerPhone}` : ""}{d.transport.address ? ` · ${d.transport.address}` : ""}</Typography>
        </Box>
        <Box sx={{ ml: "auto", minWidth: 150 }}>
          <MonthPicker value={period} onChange={setPeriod} />
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" }, gap: 2 }}>
        <Tile label="Tankers / Trucks" value={`${t.tankers}/${t.trucks}`} Icon={Truck} tone="indigo" />
        <Tile label="Loads (month)" value={t.loads} Icon={Package} tone="teal" />
        <Tile label="Km run (month)" value={t.meteredKm || t.tripKm} format="int" Icon={Gauge} tone="blue" />
        <Tile label="Salary paid (month)" value={t.salaryPaid} format="rupee" Icon={Wallet} tone="green" />
      </Box>

      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "text.primary", mb: 1, display: "flex", alignItems: "center", gap: 1 }}><Truck size={18} /> Tankers — {period}</Typography>
        <Table head={["Tanker", "Type", "Loads", "Km run (meter)", "Trip km (RTKM)", "Cargo"]}>
          {d.tankers.map((r) => (
            <Tr key={r.id}>
              <Td sx={{ fontWeight: 600, color: "text.primary" }}>{r.registrationNo}</Td>
              <Td><Badge tone={r.type === "tanker" ? "indigo" : "gray"}>{r.type}</Badge></Td>
              <Td>{r.loads}</Td>
              <Td>{r.meterReadings > 1 ? km(r.meteredKm) : <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}</Td>
              <Td>{km(r.tripKm)}</Td>
              <Td>{L(r.cargo)}</Td>
            </Tr>
          ))}
          {d.tankers.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No tankers.</Td></Tr>}
        </Table>
        <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 0.75 }}>Km run (meter) = odometer max − min from driver meter readings this month (needs ≥2 readings). Trip km (RTKM) = sum of round-trip distances of the month&apos;s loads.</Typography>
      </Box>

      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "text.primary", mb: 1, display: "flex", alignItems: "center", gap: 1 }}><Users size={18} /> Drivers — {period}</Typography>
        <Table head={["Driver", "Monthly salary", "Loads", "Salary paid", "Status"]}>
          {d.drivers.map((r) => (
            <Tr key={r.id}>
              <Td sx={{ fontWeight: 600, color: "text.primary" }}>{r.name}{r.phone ? <Box component="span" sx={{ fontWeight: 400, color: "text.disabled" }}> · {r.phone}</Box> : null}</Td>
              <Td>{rupee(r.monthlySalary)}</Td>
              <Td>{r.loads}</Td>
              <Td sx={{ fontWeight: 600 }}>{r.salaryPaid == null ? <Box component="span" sx={{ color: "text.disabled" }}>—</Box> : rupee(r.salaryPaid)}</Td>
              <Td><Badge tone={r.salaryStatus === "paid" ? "green" : r.salaryStatus === "draft" ? "yellow" : "gray"}>{r.salaryStatus === "none" ? "not generated" : r.salaryStatus}</Badge></Td>
            </Tr>
          ))}
          {d.drivers.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No drivers.</Td></Tr>}
        </Table>
      </Box>
    </Box>
  );
}
