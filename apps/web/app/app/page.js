"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useApp } from "@/lib/appContext";
import { useApi } from "@/lib/useApi";
import { Tile, RingStat, Card, Table, Td, Tr, Button, Badge, rupee, PageLoader } from "@/components/ui";
import { Truck, Users, Package, Wallet, Fuel, Wrench, AlertTriangle, Scale, BarChart3, CalendarDays } from "@/components/icons";
import { DatePicker } from "@/components/DatePicker";
import { DriverHome } from "./_driver";

// Charts (recharts) are heavy — load them lazily so the dashboard's first paint stays light on slow links.
const chartFallback = () => <Card sx={{ height: 296 }} />;
const SpendAreaChart = dynamic(() => import("@/components/Charts").then((m) => ({ default: m.SpendAreaChart })), { ssr: false, loading: chartFallback });
const SpendDonut = dynamic(() => import("@/components/Charts").then((m) => ({ default: m.SpendDonut })), { ssr: false, loading: chartFallback });

const PRESETS = [
  { key: "all", label: "All time" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "3m", label: "3 months" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// A preset key (+ custom {from,to} dates) → { from, to } ISO strings for the spend API.
function presetParams(key, custom) {
  if (key === "all") return {};
  if (key === "custom") {
    const o = {};
    if (custom.from) o.from = startOfDay(new Date(custom.from)).toISOString();
    if (custom.to) o.to = endOfDay(new Date(custom.to)).toISOString();
    return o;
  }
  const now = new Date();
  let from;
  if (key === "week") { const dow = (now.getDay() + 6) % 7; from = new Date(now); from.setDate(now.getDate() - dow); }
  else if (key === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (key === "3m") from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  else from = new Date(now.getFullYear(), 0, 1); // year
  return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() };
}

// Compact fleet count shown on the right of the Period card.
function FleetMini({ Icon, value, label, grad }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, borderRadius: 2.5, px: 1.25, py: 0.6, bgcolor: "rgba(15,23,42,0.04)" }}>
      <Box sx={{ display: "flex", width: 30, height: 30, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 1.5, color: "#fff", backgroundImage: grad }}>
        <Icon size={16} />
      </Box>
      <Box sx={{ lineHeight: 1.05 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: "text.primary" }}>{value ?? 0}</Typography>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "text.secondary" }}>{label}</Typography>
      </Box>
    </Box>
  );
}

// Period selector: preset chips + custom date range, with fleet counts on the right.
function RangeFilter({ range, setRange, custom, setCustom, loading, trucks, drivers }) {
  return (
    <Card sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1.5, rowGap: 1, p: 1.5 }}>
      <Typography component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: 14, fontWeight: 500, color: "text.secondary" }}>
        <CalendarDays size={16} /> Period
      </Typography>
      <ToggleButtonGroup exclusive value={range} onChange={(e, v) => { if (v !== null) setRange(v); }}
        sx={{ flexWrap: "wrap", gap: 0.5, borderRadius: 3, bgcolor: "rgba(15,23,42,0.05)", p: 0.5 }}>
        {PRESETS.map((p) => (
          <ToggleButton key={p.key} value={p.key} disableRipple
            sx={{
              border: "none", borderRadius: 2, px: 1.5, py: 0.75, fontSize: 14, fontWeight: 600,
              color: "text.secondary", "&.Mui-selected": { bgcolor: "background.paper", color: "primary.dark", boxShadow: "0 1px 2px rgba(15,23,42,0.08)" },
              "&.Mui-selected:hover": { bgcolor: "background.paper" }, "&:hover": { color: "text.primary" },
            }}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {range === "custom" && (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 160 }}><DatePicker value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} placeholder="From" /></Box>
          <Typography component="span" sx={{ color: "text.disabled" }}>→</Typography>
          <Box sx={{ width: 160 }}><DatePicker value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} placeholder="To" /></Box>
        </Box>
      )}
      {loading && <Typography component="span" sx={{ fontSize: 12, color: "text.disabled" }}>Updating…</Typography>}
      <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
        <FleetMini Icon={Truck} value={trucks} label="Trucks" grad="linear-gradient(135deg,#818cf8,#4f46e5)" />
        <FleetMini Icon={Users} value={drivers} label="Drivers" grad="linear-gradient(135deg,#60a5fa,#2563eb)" />
      </Box>
    </Card>
  );
}

export default function Overview() {
  const { me, activeId, activeCompany } = useApp();
  if (me.role === "admin") return <AdminRedirect />;
  if (me.role === "driver") return <DriverHome />;
  return <OwnerOverview activeId={activeId} company={activeCompany} />;
}

function AdminRedirect() {
  const router = useRouter();
  // Admins (Google or phone+PIN) get the full master-data area at /admin.
  useEffect(() => { router.replace("/admin"); }, [router]);
  return <Card>Opening admin…</Card>;
}

function OwnerOverview({ activeId, company = "all" }) {
  const [range, setRange] = useState("all");
  const [custom, setCustom] = useState({ from: "", to: "" });

  // SWR caches per (transport + company + range) key — switching back is instant, and the
  // cache persists across reloads. `null` key skips fetching until inputs are ready.
  const skip = !activeId || (range === "custom" && !custom.from && !custom.to);
  const key = skip ? null : `/api/reports/spend?${new URLSearchParams({ transportId: activeId, company, ...presetParams(range, custom) }).toString()}`;
  const { data: s, isLoading } = useApi(key);
  // Settlement / collection cards follow the SAME period filter as the spend tiles (by delivery date).
  const ledKey = skip ? null : `/api/ledger?${new URLSearchParams({ transportId: activeId, company, ...presetParams(range, custom) }).toString()}`;
  const { data: led } = useApi(ledKey);
  const loading = isLoading;

  if (!activeId) return <Card>Create a transport first to see your dashboard. <Box component={Link} href="/app/transports" sx={{ color: "info.main", textDecoration: "underline" }}>Add transport →</Box></Card>;
  if (isLoading && !s) return <PageLoader label="Loading dashboard…" />;
  const t = s?.totals || { fuel: 0, maintenance: 0, salaries: 0, mealAllowance: 0, total: 0, trips: 0, trucks: 0, drivers: 0, shortageL: 0, oilLiters: 0, extraOilL: 0, pendingInvoice: 0 };
  const L = led?.summary || { totalFreight: 0, totalReceived: 0, pendingFreight: 0, settled: 0, pending: 0, loads: 0, pendingInvoice: 0 };

  const settledPct = L.loads ? (L.settled / L.loads) * 100 : 0;
  const collectionPct = L.totalFreight ? (L.totalReceived / L.totalFreight) * 100 : 0;
  const invoiceDonePct = L.loads ? ((L.loads - L.pendingInvoice) / L.loads) * 100 : (L.loads === 0 ? 100 : 0);
  const allSettled = L.loads > 0 && L.pending === 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <RangeFilter range={range} setRange={setRange} custom={custom} setCustom={setCustom} loading={loading} trucks={t.trucks} drivers={t.drivers} />

      {/* First eye — money you're chasing today */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 2 }}>
        <RingStat tone={allSettled ? "green" : "amber"} percent={settledPct} delay={0}
          value={rupee(L.pendingFreight)} label={allSettled ? "All settled — nothing pending" : "Settlement pending"}
          sub={`${L.settled}/${L.loads} deliveries settled by bank`} />
        <RingStat tone="green" percent={collectionPct} delay={80}
          value={rupee(L.totalReceived)} label="Received in bank"
          sub={`of ${rupee(L.totalFreight)} freight charged`} />
        <RingStat tone={L.pendingInvoice > 0 ? "rose" : "blue"} percent={invoiceDonePct} delay={160}
          value={L.pendingInvoice} label="Invoices to upload"
          sub={L.pendingInvoice > 0 ? "deliveries missing their invoice" : "every delivery has its invoice"} />
      </Box>

      {/* Operating spend */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 2 }}>
        <Tile label="Total spend" value={t.total} format="rupee" Icon={Wallet} tone="green" delay={0} />
        <Tile label="Fuel (diesel)" value={t.fuel} format="rupee" Icon={Fuel} tone="indigo" delay={60} />
        <Tile label="Diesel given" value={t.oilLiters} format="litre" Icon={Fuel} tone="blue" delay={120} />
        <Tile label="Extra diesel" value={t.extraOilL} format="litre" Icon={Fuel} tone="rose" delay={180} />
        <Tile label="Meal allowance" value={t.mealAllowance} format="rupee" Icon={Wallet} tone="blue" delay={240} />
        <Tile label="Maintenance" value={t.maintenance} format="rupee" Icon={Wrench} tone="amber" delay={300} />
        <Tile label="Salaries paid" value={t.salaries} format="rupee" Icon={Wallet} tone="green" delay={360} />
        <Tile label="Oil shortage" value={t.shortageL} format="litre" Icon={AlertTriangle} tone="rose" delay={420} />
        <Tile label="Trips" value={t.trips} Icon={Package} tone="teal" delay={480} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { lg: "repeat(2,1fr)" }, gap: 2 }}>
        <SpendAreaChart data={s?.byMonth || []} />
        <SpendDonut totals={t} />
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        <Link href="/app/ledger"><Button variant="secondary" Icon={Scale}>Statement of Freight</Button></Link>
        <Link href="/app/reports"><Button variant="secondary" Icon={BarChart3}>Reports</Button></Link>
        <Link href="/app/salaries"><Button variant="secondary" Icon={Wallet}>Run salaries</Button></Link>
        <Typography component="span" sx={{ fontSize: 14, color: "text.disabled" }}>
          Tap <Box component="b" sx={{ color: "primary.main" }}>Upload PDF</Box> (bottom-right) to add documents.
        </Typography>
      </Box>
    </Box>
  );
}
