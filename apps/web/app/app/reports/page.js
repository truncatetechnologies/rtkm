"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { useApi } from "@/lib/useApi";
import { Card, Table, Td, Tr, Badge, Tile, Button, rupee, PageLoader, SkeletonPage } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { IndianRupee, Wallet, Clock, TrendingDown, AlertTriangle, Fuel, Truck } from "@/components/icons";

export default function Reports() {
  const { activeId } = useApp();
  const [tab, setTab] = useState("settlement");
  if (!activeId) return <Card>Select or create a transport first.</Card>;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box sx={{ display: "flex", gap: 1 }}>
        {[["settlement", "Settlement (charged vs received)"], ["profit", "Profitability"], ["shortage", "Driver shortage"], ["extraoil", "Extra oil"]].map(([k, label]) => (
          <Button key={k} variant="ghost" onClick={() => setTab(k)}
            className={tab === k ? undefined : "glass"}
            sx={{ borderRadius: 999, px: 2, py: 0.75, fontSize: 14, fontWeight: 600, ...(tab === k ? { bgcolor: "#4f46e5", color: "#fff", "&:hover": { bgcolor: "#4338ca" } } : { color: "text.secondary" }) }}>
            {label}
          </Button>
        ))}
      </Box>
      {tab === "settlement" ? <Settlement activeId={activeId} /> : tab === "profit" ? <Profitability activeId={activeId} /> : tab === "shortage" ? <DriverShortage activeId={activeId} /> : <ExtraOilReport activeId={activeId} />}
    </Box>
  );
}

function Profitability({ activeId }) {
  const { data } = useApi(activeId ? `/api/reports/profitability?transportId=${activeId}` : null);
  if (!data) return <SkeletonPage tiles={4} cols={10} />;
  const d = data || { rows: [], totals: {} };
  const t = d.totals || {};
  const monthName = (m) => { if (!m) return "—"; const [y, mo] = m.split("-"); return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }); };
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Monthly profit = freight <b>received in bank</b> − (driver diesel + extra oil + maintenance + salaries paid).</Typography>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" } }}>
        <Tile label="Received" value={t.received || 0} format="rupee" Icon={Wallet} tone="green" delay={0} />
        <Tile label="Total costs" value={t.costs || 0} format="rupee" Icon={TrendingDown} tone="amber" delay={60} />
        <Tile label="Profit" value={t.profit || 0} format="rupee" Icon={IndianRupee} tone={t.profit >= 0 ? "indigo" : "rose"} delay={120} />
        <Tile label="Salaries paid" value={t.salaries || 0} format="rupee" Icon={Wallet} tone="blue" delay={180} />
      </Box>
      <Table head={["Month", "Received", "Diesel", "Tolls", "Extra oil", "Meal", "Maintenance", "Salaries", "Costs", "Profit"]}>
        {d.rows.map((r) => (
          <Tr key={r.month}>
            <Td sx={{ fontWeight: 600, color: "text.primary" }}>{monthName(r.month)}</Td>
            <Td sx={{ fontWeight: 600, color: "success.main" }}>{rupee(r.received)}</Td>
            <Td>{rupee(r.fuel)}</Td>
            <Td>{rupee(r.fastag)}</Td>
            <Td>{rupee(r.extraOil)}</Td>
            <Td>{rupee(r.mealAllowance)}</Td>
            <Td>{rupee(r.maintenance)}</Td>
            <Td>{rupee(r.salaries)}</Td>
            <Td sx={{ color: "text.secondary" }}>{rupee(r.costs)}</Td>
            <Td sx={{ fontWeight: 700, color: r.profit >= 0 ? "#059669" : "#e11d48" }}>{rupee(r.profit)}</Td>
          </Tr>
        ))}
        {d.rows.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No data yet — upload statements & bank advices to see monthly profit.</Td></Tr>}
      </Table>
    </Box>
  );
}

function ExtraOilReport({ activeId }) {
  const [period, setPeriod] = useState("");
  const { data } = useApi(activeId ? `/api/reports/extra-oil?transportId=${activeId}${period ? `&period=${period}` : ""}` : null);
  if (!data) return <SkeletonPage tiles={3} cols={4} />;
  const d = data || { byDriver: [], byTruck: [], totals: {}, months: [] };
  const t = d.totals || {};

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>Month:</Typography>
        <Box component="select" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ borderRadius: 2, border: "1px solid", borderColor: "#e2e8f0", bgcolor: "#fff", px: 1.5, py: 0.75, fontSize: 14 }}>
          <option value="">All months</option>
          {d.months.map((m) => <option key={m} value={m}>{m}</option>)}
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(3,1fr)" }}>
        <Tile label="Times extra given" value={t.times || 0} Icon={AlertTriangle} tone="amber" delay={0} />
        <Tile label="Total extra diesel" value={`${Math.round(t.totalL || 0)} L`} Icon={Fuel} tone="blue" delay={60} />
        <Tile label="Total extra cost" value={t.totalCost || 0} format="rupee" Icon={TrendingDown} tone="rose" delay={120} />
      </Box>

      <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Who asks for extra diesel — sorted worst-first so you can act on a particular driver or tanker.</Typography>
      <Table head={["Driver", "Times", "Total litres", "Total cost"]}>
        {d.byDriver.map((r) => (
          <Tr key={r.key}>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{r.label}</Td>
            <Td sx={{ fontWeight: 600 }}>{r.times}</Td>
            <Td sx={{ fontWeight: 600, color: "#2563eb" }}>{Math.round(r.totalL)} L</Td>
            <Td>{r.totalCost ? rupee(r.totalCost) : "—"}</Td>
          </Tr>
        ))}
        {d.byDriver.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No extra-oil entries.</Td></Tr>}
      </Table>

      <Typography sx={{ fontSize: 14, color: "text.secondary", display: "flex", alignItems: "center", gap: 0.75 }}><Truck size={16} /> By tanker</Typography>
      <Table head={["Tanker", "Times", "Total litres", "Total cost"]}>
        {d.byTruck.map((r) => (
          <Tr key={r.key}>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{r.label}</Td>
            <Td sx={{ fontWeight: 600 }}>{r.times}</Td>
            <Td sx={{ fontWeight: 600, color: "#2563eb" }}>{Math.round(r.totalL)} L</Td>
            <Td>{r.totalCost ? rupee(r.totalCost) : "—"}</Td>
          </Tr>
        ))}
        {d.byTruck.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No extra-oil entries.</Td></Tr>}
      </Table>
    </Box>
  );
}

function Settlement({ activeId }) {
  const { activeCompany = "all" } = useApp();
  const { data: ledgerData, isLoading: loadingLedger } = useApi(activeId ? `/api/ledger?transportId=${activeId}&company=${activeCompany}` : null);
  const data = ledgerData || { loads: [], summary: {} };
  const [shortOnly, setShortOnly] = useState(false);

  const s = data.summary || {};

  if (loadingLedger && !ledgerData) return <SkeletonPage tiles={5} cols={8} />;

  const rows = data.loads
    .map((l) => ({ ...l, cut: (l.nayaraShortageDeduction || 0) + (l.otherDeduction || 0), gap: (l.freightAmount || 0) - (l.netReceived || 0) }))
    .filter((l) => (shortOnly ? l.cut > 0 : true));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(5,1fr)" } }}>
        <Tile label="Should settle" value={s.totalFreight || 0} format="rupee" Icon={IndianRupee} tone="indigo" delay={0} />
        <Tile label="Actually received" value={s.totalReceived || 0} format="rupee" Icon={Wallet} tone="green" delay={60} />
        <Tile label="Pending (not paid)" value={s.pendingFreight || 0} format="rupee" Icon={Clock} tone="amber" delay={120} />
        <Tile label="TDS (tax credit)" value={s.totalTds || 0} format="rupee" Icon={TrendingDown} tone="blue" delay={180} />
        <Tile label="Shortage cut (loss)" value={s.totalDeduction || 0} format="rupee" Icon={AlertTriangle} tone="rose" delay={240} />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Per-invoice: what Nayara should pay vs what actually hit the bank.</Typography>
        <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 14, color: "text.secondary" }}>
          <input type="checkbox" checked={shortOnly} onChange={(e) => setShortOnly(e.target.checked)} />
          Only short-paid (received less)
        </Box>
      </Box>

      <Table head={["Invoice", "Pump", "Should settle", "TDS", "Shortage cut", "Received", "Gap", "Status"]}>
        {rows.map((l) => (
          <Tr key={l.id}>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{l.invoiceNumber || "—"}</Td>
            <Td>{l.cmsCode || "—"}</Td>
            <Td sx={{ fontWeight: 600 }}>{rupee(l.freightAmount)}</Td>
            <Td sx={{ color: "#2563eb" }}>{l.tdsAmount ? "− " + rupee(l.tdsAmount) : "—"}</Td>
            <Td>{l.cut ? <Box component="span" sx={{ fontWeight: 500, color: "error.main" }}>− {rupee(l.cut)}</Box> : "—"}</Td>
            <Td sx={{ fontWeight: 600, color: "success.main" }}>{l.netReceived ? rupee(l.netReceived) : "—"}</Td>
            <Td>{l.settlementStatus === "settled" ? <Box component="span" sx={l.cut > 0 ? { color: "error.main", fontWeight: 500 } : { color: "text.secondary" }}>{rupee(l.gap)}</Box> : "—"}</Td>
            <Td>
              {l.settlementStatus === "settled"
                ? <Badge tone={l.cut > 0 ? "red" : "green"}>{l.cut > 0 ? "short-paid" : "settled"}</Badge>
                : <Badge tone="yellow">pending</Badge>}
            </Td>
          </Tr>
        ))}
        {rows.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>{shortOnly ? "No short-paid invoices 🎉" : "No deliveries yet."}</Td></Tr>}
      </Table>
    </Box>
  );
}

function DriverShortage({ activeId }) {
  const [period, setPeriod] = useState("");
  const { data: shortageData } = useApi(activeId ? `/api/reports/driver-shortage?transportId=${activeId}${period ? `&period=${period}` : ""}` : null);
  if (!shortageData) return <SkeletonPage tiles={3} cols={5} />;
  const data = shortageData || { rows: [], totals: {}, months: [] };

  const t = data.totals || {};

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>Month:</Typography>
        <Box component="select" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ borderRadius: 2, border: "1px solid", borderColor: "#e2e8f0", bgcolor: "#fff", px: 1.5, py: 0.75, fontSize: 14 }}>
          <option value="">All months</option>
          {data.months.map((m) => <option key={m} value={m}>{m}</option>)}
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(3,1fr)" }}>
        <Tile label="Total shortage" value={`${(t.shortageL || 0).toFixed(0)} L`} Icon={AlertTriangle} tone="rose" delay={0} />
        <Tile label="Total ₹ cut" value={t.shortageValue || 0} format="rupee" Icon={TrendingDown} tone="amber" delay={60} />
        <Tile label="Trips w/ shortage" value={t.trips || 0} Icon={Clock} tone="indigo" delay={120} />
      </Box>

      <Table head={["Driver", "Month", "Shortage (L)", "₹ cut from salary", "Trips"]}>
        {data.rows.map((r, i) => (
          <Tr key={i}>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{r.driverName}</Td>
            <Td>{r.period}</Td>
            <Td sx={{ fontWeight: 500, color: "error.main" }}>{r.shortageL} L</Td>
            <Td>{rupee(r.shortageValue)}</Td>
            <Td>{r.trips}</Td>
          </Tr>
        ))}
        {data.rows.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No shortages recorded.</Td></Tr>}
      </Table>
    </Box>
  );
}
