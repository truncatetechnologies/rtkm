"use client";
import { Fragment, useEffect, useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Field, Select, Input, Table, Td, Tr, Badge, rupee, IconButton, useConfirm, PageLoader } from "@/components/ui";
import { MonthPicker, DatePicker } from "@/components/DatePicker";
import { Box, Typography } from "@mui/material";
import { Wallet, CheckCircle2, Trash2, Plus, CalendarDays, ChevronDown, ChevronRight } from "@/components/icons";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—");

export default function Salaries() {
  const { activeId } = useApp();
  const { data: driversData } = useApi(activeId ? `/api/members?transportId=${activeId}&role=driver` : null);
  const { data: slipsData, mutate: mutateSlips, isLoading: loadingSlips } = useApi(activeId ? `/api/salary?transportId=${activeId}` : null);
  const drivers = driversData?.members || [];
  const slips = slipsData?.payslips || [];
  const [driverId, setDriverId] = useState("");
  const [period, setPeriod] = useState(thisMonth());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [openId, setOpenId] = useState(null); // payslip whose deduction breakdown is expanded
  const { confirm, ConfirmModal } = useConfirm();

  useEffect(() => { if (!driverId && drivers[0]) setDriverId(drivers[0].id); }, [driverId, drivers]);

  async function generate() {
    setBusy(true); setMsg("");
    try {
      const r = await api("/api/salary/generate", { method: "POST", body: { transportId: activeId, driverId, period } });
      const p = r.payslip;
      setMsg(`Payslip ready: net ${rupee(p.netPay)} — paid ${p.payableDays}/${p.daysInMonth} days${p.leaveDays ? `, ${p.leaveDays} leave` : ""}.`);
      mutateSlips();
    } catch (e) { setMsg(String(e.message || e)); } finally { setBusy(false); }
  }
  async function pay(id) {
    if (!(await confirm({ title: "Mark payslip as paid?", message: "Confirm you've paid this driver for the period.", confirmLabel: "Mark paid" }))) return;
    await api(`/api/salary/${id}/pay`, { method: "POST" }); mutateSlips();
  }
  async function discard(id) {
    if (!(await confirm({ title: "Discard this payslip?", message: "The draft will be deleted and its oil-shortage deductions released back to pending (so they apply to a future payslip).", confirmLabel: "Discard", danger: true }))) return;
    await api(`/api/salary/${id}`, { method: "DELETE" }); mutateSlips();
  }
  const driver = drivers.find((d) => d.id === driverId);
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  if (loadingSlips && !slipsData) return <PageLoader label="Loading salaries…" />;

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 1.5 }}>
          <Field label="Driver"><Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Month"><MonthPicker value={period} onChange={setPeriod} /></Field>
          <Button Icon={Wallet} onClick={generate} disabled={busy || !driverId}>{busy ? "Generating…" : "Generate payslip"}</Button>
        </Box>
        {msg && <Typography sx={{ mt: 1.5, fontSize: 14, fontWeight: 500, color: "primary.dark" }}>{msg}</Typography>}
        <Typography sx={{ mt: 1, fontSize: 12, color: "text.disabled" }}>
          Net = pro-rated base − open oil-shortage deductions. Base is the monthly salary split over the days in the month, paid only for days worked (from the joining date) minus unpaid leave. Generating marks shortages as deducted.
        </Typography>
      </Card>

      {driver && <LeavePanel transportId={activeId} driver={driver} />}

      <Table head={["Period", "Driver", "Monthly", "Days paid", "Leave", "Base", "Deductions", "Net pay", "Status", ""]}>
        {slips.map((p) => {
          const dedTotal = p.deductions.reduce((s, d) => s + d.amount, 0);
          const addTotal = (p.additions || []).reduce((s, a) => s + a.amount, 0);
          const hasDetail = p.deductions.length > 0 || addTotal > 0;
          const open = openId === p.id;
          return (
          <Fragment key={p.id}>
          <Tr>
            <Td>{p.period}</Td>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{driverName(p.driverId)}</Td>
            <Td>{rupee(p.monthlySalary || p.baseSalary)}</Td>
            <Td>{p.daysInMonth ? `${p.payableDays}/${p.daysInMonth}` : "—"}</Td>
            <Td>{p.leaveDays ? <Badge tone="yellow">{p.leaveDays}d</Badge> : "—"}</Td>
            <Td>{rupee(p.baseSalary)}</Td>
            <Td>
              {hasDetail ? (
                <Box component="button" onClick={() => setOpenId(open ? null : p.id)}
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, border: "none", bgcolor: "transparent", cursor: "pointer", p: 0, font: "inherit", color: dedTotal > 0 ? "error.main" : "text.primary", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{rupee(dedTotal)}
                </Box>
              ) : rupee(dedTotal)}
            </Td>
            <Td sx={{ fontWeight: 600 }}>{rupee(p.netPay)}</Td>
            <Td><Badge tone={p.status === "paid" ? "green" : "yellow"}>{p.status}</Badge></Td>
            <Td><Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>{p.status === "draft" && <>
              <IconButton Icon={CheckCircle2} label="Mark paid" tone="emerald" onClick={() => pay(p.id)} />
              <IconButton Icon={Trash2} label="Discard" tone="rose" onClick={() => discard(p.id)} />
            </>}</Box></Td>
          </Tr>
          {open && hasDetail && (
            <Tr>
              <Td colSpan={10} sx={{ bgcolor: "rgba(15,23,42,0.02)", py: 1.5 }}>
                <Box sx={{ pl: 2 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4, mb: 0.5 }}>Salary breakdown — {p.period}</Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between", maxWidth: 520, fontSize: 13.5, py: 0.4 }}>
                    <Typography sx={{ color: "text.secondary" }}>Pro-rated base ({p.payableDays}/{p.daysInMonth} days)</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{rupee(p.baseSalary)}</Typography>
                  </Box>
                  {(p.additions || []).map((a, i) => (
                    <Box key={`a${i}`} sx={{ display: "flex", justifyContent: "space-between", maxWidth: 520, fontSize: 13.5, py: 0.4 }}>
                      <Typography sx={{ color: "success.main" }}>+ {a.reason || "Addition"}</Typography>
                      <Typography sx={{ fontWeight: 600, color: "success.main" }}>+{rupee(a.amount)}</Typography>
                    </Box>
                  ))}
                  {p.deductions.length === 0 && <Typography sx={{ fontSize: 13, color: "text.disabled", py: 0.4 }}>No deductions.</Typography>}
                  {p.deductions.map((d, i) => (
                    <Box key={`d${i}`} sx={{ display: "flex", justifyContent: "space-between", maxWidth: 520, fontSize: 13.5, py: 0.4 }}>
                      <Typography sx={{ color: "error.main" }}>− {d.reason || "Deduction"}</Typography>
                      <Typography sx={{ fontWeight: 600, color: "error.main" }}>−{rupee(d.amount)}</Typography>
                    </Box>
                  ))}
                  <Box sx={{ display: "flex", justifyContent: "space-between", maxWidth: 520, fontSize: 14, py: 0.6, mt: 0.4, borderTop: "1px solid", borderColor: "divider" }}>
                    <Typography sx={{ fontWeight: 700 }}>Net pay</Typography>
                    <Typography sx={{ fontWeight: 800 }}>{rupee(p.netPay)}</Typography>
                  </Box>
                </Box>
              </Td>
            </Tr>
          )}
          </Fragment>
          );
        })}
        {slips.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No payslips yet.</Td></Tr>}
      </Table>
      {ConfirmModal}
    </Box>
  );
}

// Leave log for the selected driver — record unpaid/paid leaves that pro-rate the salary.
function LeavePanel({ transportId, driver }) {
  const { data, mutate } = useApi(`/api/leaves?transportId=${transportId}&driverId=${driver.id}`);
  const leaves = data?.leaves || [];
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paid, setPaid] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  async function add() {
    if (!from) return;
    setBusy(true);
    try {
      await api("/api/leaves", { method: "POST", body: { transportId, driverId: driver.id, fromDate: from, toDate: to || from, paid, reason } });
      setFrom(""); setTo(""); setReason(""); setPaid(false); mutate();
    } catch (e) { alert(String(e.message || e)); } finally { setBusy(false); }
  }
  async function remove(id) {
    if (!(await confirm({ title: "Remove this leave?", message: "Re-generate the month's payslip afterwards to update the pro-rated pay.", confirmLabel: "Remove", danger: true }))) return;
    await api(`/api/leaves/${id}`, { method: "DELETE" }); mutate();
  }

  return (
    <Card sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <CalendarDays size={18} color="#6366f1" />
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "text.primary" }}>Leaves — {driver.name}</Typography>
        {driver.joiningDate && <Typography sx={{ fontSize: 12, color: "text.disabled" }}>· joined {fmtDay(driver.joiningDate)}</Typography>}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 1.5, mb: 2 }}>
        <Field label="From"><DatePicker value={from} onChange={setFrom} /></Field>
        <Field label="To (optional)"><DatePicker value={to} onChange={setTo} placeholder="Same day" /></Field>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="sick / personal…" /></Field>
        <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: 14, color: "text.primary", pb: 0.75 }}>
          <Box component="input" type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} sx={{ width: 16, height: 16 }} />
          Paid leave (no cut)
        </Box>
        <Button Icon={Plus} onClick={add} disabled={busy || !from}>Add leave</Button>
      </Box>
      <Table head={["From", "To", "Days", "Type", "Reason", ""]}>
        {leaves.map((l) => (
          <Tr key={l.id}>
            <Td>{fmtDay(l.fromDate)}</Td>
            <Td>{fmtDay(l.toDate)}</Td>
            <Td>{l.days}</Td>
            <Td><Badge tone={l.paid ? "green" : "yellow"}>{l.paid ? "Paid" : "Unpaid"}</Badge></Td>
            <Td sx={{ color: "text.secondary" }}>{l.reason || "—"}</Td>
            <Td><Box sx={{ display: "flex", justifyContent: "flex-end" }}><IconButton Icon={Trash2} label="Remove" tone="rose" onClick={() => remove(l.id)} /></Box></Td>
          </Tr>
        ))}
        {leaves.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No leaves logged.</Td></Tr>}
      </Table>
      {ConfirmModal}
    </Card>
  );
}
