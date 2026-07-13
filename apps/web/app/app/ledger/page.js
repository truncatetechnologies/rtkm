"use client";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { Card, Table, Td, Tr, Badge, Tile, Button, Modal, Field, Input, Select, IconButton, useConfirm, rupee, PageLoader, SkeletonPage } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { Wallet, IndianRupee, TrendingDown, Clock, Fuel, Truck, Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Toll } from "@/components/icons";
import SyncBar from "@/components/SyncBar";

const FILTERS = [["all", "All"], ["pending", "Pending"], ["settled", "Settled"]];
const PERIODS = [["1m", "This month"], ["3m", "3 months"], ["6m", "6 months"], ["year", "This year"], ["all", "All time"]];
// A period key → ISO "from" date (loadDate ≥ from). "" = no lower bound (all time).
function periodFrom(key) {
  if (key === "all") return "";
  const now = new Date();
  const from =
    key === "1m" ? new Date(now.getFullYear(), now.getMonth(), 1)
    : key === "6m" ? new Date(now.getFullYear(), now.getMonth() - 5, 1)
    : key === "year" ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear(), now.getMonth() - 2, 1); // 3m default
  from.setHours(0, 0, 0, 0);
  return from.toISOString();
}
const REASONS = [["breakdown", "Breakdown"], ["route_change", "Route change"], ["route_issue", "Route issue / detour"], ["other", "Other"]];
const reasonLabel = (r) => REASONS.find(([k]) => k === r)?.[1] || r;

// Club loads that share a Shipment No. The tanker drives to the farthest pump only,
// so oil is given once per shipment based on the longest RTKM (not per pump).
// Extra oil entries are matched to their shipment (or, for a solo load, by loadId).
function groupByShipment(loads, extra) {
  const map = new Map();
  for (const l of loads) {
    const key = l.shipmentNo || `solo:${l.id}`;
    if (!map.has(key)) map.set(key, { shipmentNo: l.shipmentNo || "", loads: [] });
    map.get(key).loads.push(l);
  }
  return [...map.values()].map((g) => {
    const loadIds = new Set(g.loads.map((l) => l.id));
    const extraEntries = (extra || []).filter((e) => (g.shipmentNo ? e.shipmentNo === g.shipmentNo : (e.loadId && loadIds.has(e.loadId))));
    const lead = g.loads.reduce((a, l) => ((l.rtkm || 0) > (a.rtkm || 0) ? l : a), g.loads[0]);
    return {
      ...g,
      lead,
      extraEntries,
      pumps: g.loads.length,
      cargo: g.loads.reduce((s, l) => s + (l.loadQtyL || 0), 0),
      freight: g.loads.reduce((s, l) => s + (l.freightAmount || 0), 0),
      maxRtkm: g.loads.reduce((m, l) => Math.max(m, l.rtkm || 0), 0),
      oil: g.loads.reduce((m, l) => Math.max(m, l.shipmentOilLiters || 0), 0),
      oilCost: g.loads.reduce((s, l) => s + (l.oilCost || 0), 0), // ₹ of diesel given (lead-load only)
      meal: g.loads.reduce((s, l) => s + (l.mealAllowance || 0), 0), // ₹ meal allowance (lead-load only)
      extraL: extraEntries.reduce((s, e) => s + (e.litres || 0), 0),
      extraCost: extraEntries.reduce((s, e) => s + (e.cost || 0), 0),
    };
  });
}

export default function Ledger() {
  const { activeId, activeCompany = "all" } = useApp();
  const [data, setData] = useState({ loads: [], summary: null });
  const [extra, setExtra] = useState([]);
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState("3m"); // default to recent 3 months so the page loads fast
  const [loading, setLoading] = useState(true);
  const [extraFor, setExtraFor] = useState(null); // shipment group we're adding extra oil to
  const [helpOpen, setHelpOpen] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  const load = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `&status=${filter}`;
      const fromParam = periodFrom(period); // only fetch the selected window → faster
      const dq = fromParam ? `&from=${encodeURIComponent(fromParam)}` : "";
      const [led, ext] = await Promise.all([
        api(`/api/ledger?transportId=${activeId}&company=${activeCompany}${q}${dq}`),
        api(`/api/extra-oil?transportId=${activeId}`),
      ]);
      setData(led); setExtra(ext.extraOil || []);
    } finally { setLoading(false); }
  }, [activeId, activeCompany, filter, period]);
  useEffect(() => { load(); }, [load]);

  async function ackInvoice(invoiceNumber) {
    await api("/api/loads/ack-invoice", { method: "POST", body: { transportId: activeId, invoiceNumber } });
    load();
  }

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  // First load (server can be slow on cold start) — show a clear loader instead of an empty page.
  if (loading && !data.summary) return <SkeletonPage tiles={3} cols={6} />;
  const s = data.summary || {};
  const groups = groupByShipment(data.loads, extra);
  const totalExtra = extra.reduce((sum, e) => sum + (e.litres || 0), 0);
  const pendingInvoices = [...new Set(data.loads.filter((l) => !l.hasInvoice && !l.invoiceAck).map((l) => l.invoiceNumber).filter(Boolean))];

  async function removeExtra(id) {
    if (!(await confirm({ title: "Remove extra oil?", message: "This deletes this extra-oil entry.", confirmLabel: "Remove", danger: true }))) return;
    await api(`/api/extra-oil/${id}`, { method: "DELETE" }); load();
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box className="glass" sx={{ borderRadius: 3, border: "1px solid", borderColor: "rgba(255,255,255,0.6)", overflow: "hidden" }}>
        <Box onClick={() => setHelpOpen((o) => !o)}
          sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", px: 2, py: 1.25, userSelect: "none", "&:hover": { bgcolor: "rgba(79,70,229,0.04)" } }}>
          <Box component={IndianRupee} size={16} sx={{ color: "primary.main" }} />
          <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 600, color: "text.primary" }}>How the Statement of Freight works</Typography>
          <Typography sx={{ fontSize: 12, color: "text.disabled", mr: 0.5 }}>{helpOpen ? "Hide" : "Read"}</Typography>
          <Box component={helpOpen ? ChevronDown : ChevronRight} size={18} sx={{ color: "text.disabled" }} />
        </Box>
        {helpOpen && (
          <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
            <Box sx={{ display: "grid", gap: 1.5, fontSize: 14, gridTemplateColumns: { sm: "repeat(3,1fr)" } }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}><Box component="span" sx={{ display: "flex", height: 24, width: 24, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: "50%", bgcolor: "#4f46e5", fontSize: 12, fontWeight: 700, color: "#fff" }}>1</Box><Box component="span" sx={{ color: "text.secondary" }}><Box component="b" sx={{ color: "text.primary" }}>Invoice</Box> — Nayara invoices a load; your tanker delivers oil to the pump.</Box></Box>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}><Box component="span" sx={{ display: "flex", height: 24, width: 24, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: "50%", bgcolor: "#4f46e5", fontSize: 12, fontWeight: 700, color: "#fff" }}>2</Box><Box component="span" sx={{ color: "text.secondary" }}><Box component="b" sx={{ color: "text.primary" }}>Statement of Freight</Box> — period statement: deliveries, shortage & freight amount for many invoices.</Box></Box>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}><Box component="span" sx={{ display: "flex", height: 24, width: 24, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: "50%", bgcolor: "#4f46e5", fontSize: 12, fontWeight: 700, color: "#fff" }}>3</Box><Box component="span" sx={{ color: "text.secondary" }}><Box component="b" sx={{ color: "text.primary" }}>Bank Payment Advice</Box> — actual settlement: gross − TDS − cuts = received.</Box></Box>
            </Box>
            <Typography sx={{ mt: 1.5, fontSize: 14, color: "text.secondary" }}>Deliveries are grouped by <Box component="b" sx={{ color: "primary.main" }}>Shipment No</Box>. Diesel is planned from the farthest pump's RTKM. If you give a driver <Box component="b">extra diesel</Box> mid-trip (breakdown / route change), add it on that shipment with <b>+ Extra oil</b> — it's tracked per truck &amp; driver in Reports.</Typography>
          </Box>
        )}
      </Box>

      <ReconciliationCard s={s} />

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(6,1fr)" } }}>
        <Tile label="Freight charged" value={s.totalFreight || 0} format="rupee" Icon={IndianRupee} tone="indigo" delay={0} />
        <Tile label="Received in bank" value={s.totalReceived || 0} format="rupee" Icon={Wallet} tone="green" delay={60} />
        <Tile label="Pending" value={s.pendingFreight || 0} format="rupee" Icon={Clock} tone="amber" delay={120} />
        <Tile label="Shortage cut (Nayara)" value={s.totalDeduction || 0} format="rupee" Icon={TrendingDown} tone="rose" delay={180} />
        <Tile label="Diesel (planned)" value={`${Math.round(s.totalOil || 0)} L`} Icon={Fuel} tone="blue" delay={240} />
        <Tile label="Diesel (extra)" value={`${Math.round(totalExtra)} L`} Icon={Fuel} tone="rose" delay={300} />
      </Box>

      {pendingInvoices.length > 0 && (
        <Box sx={{ borderRadius: 3, bgcolor: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)", px: 2, py: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700, color: "#b45309" }}>
            <AlertTriangle size={18} /> {pendingInvoices.length} deliveries are missing their Invoice PDF
          </Box>
          <Typography sx={{ mt: 0.5, fontSize: 13, color: "#92400e" }}>
            These came from a Statement of Freight but their <b>Tax Invoice hasn't been uploaded</b>. Upload it, or if you won't get the invoice for one, tap <b>✓ received</b> to acknowledge it so it stops counting.
          </Typography>
          <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {pendingInvoices.map((inv) => (
              <Box key={inv} sx={{ display: "flex", alignItems: "center", gap: 0.5, borderRadius: 999, bgcolor: "rgba(255,255,255,0.8)", border: "1px solid rgba(245,158,11,0.4)", pl: 1.25, pr: 0.5, py: 0.25 }}>
                <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 600, color: "#92400e", fontFamily: "monospace" }}>{inv}</Typography>
                <Box component="button" onClick={() => ackInvoice(inv)} title="Mark received offline"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, border: "none", cursor: "pointer", borderRadius: 999, bgcolor: "rgba(16,185,129,0.15)", color: "#059669", fontSize: 11.5, fontWeight: 700, px: 0.75, py: 0.25, "&:hover": { bgcolor: "rgba(16,185,129,0.28)" } }}>
                  <CheckCircle2 size={13} /> received
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        {FILTERS.map(([k, label]) => (
          <Button key={k} variant="ghost" onClick={() => setFilter(k)}
            className={filter === k ? undefined : "glass"}
            sx={{ borderRadius: 999, px: 2, py: 0.75, fontSize: 14, fontWeight: 600, ...(filter === k ? { bgcolor: "#4f46e5", color: "#fff", "&:hover": { bgcolor: "#4338ca" } } : { color: "text.secondary" }) }}>
            {label}{k === "settled" && s.settled != null ? ` (${s.settled})` : k === "pending" && s.pending != null ? ` (${s.pending})` : ""}
          </Button>
        ))}
        <Box sx={{ ml: { sm: "auto" }, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <SyncBar page="ledger" onDone={load} label="Sync from Gmail" />
          <Typography component="span" sx={{ fontSize: 13, color: "text.secondary" }}>Period</Typography>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ width: "auto", minWidth: 130 }}>
            {PERIODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Box>
      </Box>

      <Table head={["Invoice date", "Invoice", "Pump", "Vehicle / Driver", "Sale (L)", "Deliv (L)", "Short (L)", "RTKM", "Rate", "Freight ₹", "Net recd", "Settled date", "Status"]}>
        {groups.map((g) => (
          <ShipmentGroup key={g.shipmentNo || g.loads[0].id} g={g}
            fastag={(data.fastagByShipment || {})[g.shipmentNo || `solo:${g.loads[0].id}`]}
            onAddExtra={() => setExtraFor(g)} onRemoveExtra={removeExtra} />
        ))}
        {data.loads.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No deliveries yet. Upload a Statement of Freight to begin.</Td></Tr>}
      </Table>

      {ConfirmModal}
      {extraFor && <ExtraOilModal group={extraFor} transportId={activeId} onClose={() => setExtraFor(null)} onSaved={() => { setExtraFor(null); load(); }} />}
    </Box>
  );
}

// Big, animated reconciliation card: freight says N deliveries should pay; the bank settled M.
// If M < N, that gap (₹ still to come) is the discrepancy — shown loud so nothing slips through.
function ReconciliationCard({ s }) {
  const total = s.loads || 0;
  if (!total) return null;
  const settled = s.settled || 0;
  const pending = s.pending || 0;
  const ok = pending === 0;
  const received = s.totalReceived || 0;
  const pendingFreight = s.pendingFreight || 0;

  return (
    <Box className="animate-pop">
      <Box sx={{
        position: "relative", overflow: "hidden", borderRadius: "16px", color: "#fff",
        p: 1.25, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
        backgroundImage: ok ? "linear-gradient(135deg,#34d399 0%,#22d3ee 100%)" : "linear-gradient(135deg,#fbbf24 0%,#fb7185 100%)",
        boxShadow: "0 8px 20px -16px rgba(15,23,42,0.4)",
      }}>
        {/* faint icon in the corner */}
        <Box component={ok ? CheckCircle2 : AlertTriangle} sx={{ position: "absolute", right: -12, bottom: -16, width: 84, height: 84, opacity: 0.13 }} />

        <Box sx={{ display: "flex", height: 36, width: 36, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: "10px", bgcolor: "rgba(255,255,255,0.22)" }}>
          <Box component={ok ? CheckCircle2 : AlertTriangle} sx={{ width: 20, height: 20 }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 150, zIndex: 1 }}>
          <Typography sx={{ fontSize: { xs: 15, md: 17 }, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.3 }}>
            {ok ? `All ${total} settled` : `${pending} settlement${pending > 1 ? "s" : ""} pending`}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 12, fontWeight: 500, opacity: 0.95, lineHeight: 1.25 }}>
            {ok
              ? `Bank has settled every delivery.`
              : `Freight ${total}, bank settled ${settled} · ${settled}/${total} settled · ${pending} pending.`}
          </Typography>
        </Box>

        <Box sx={{ zIndex: 1, textAlign: { xs: "left", sm: "right" }, pr: 0.5 }}>
          <Typography sx={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.85, lineHeight: 1 }}>
            {ok ? "Received" : "Still to receive"}
          </Typography>
          <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, lineHeight: 1.1 }}>
            {rupee(ok ? received : pendingFreight)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function ShipmentGroup({ g, fastag, onAddExtra, onRemoveExtra }) {
  const multi = g.pumps > 1;
  const [tollsOpen, setTollsOpen] = useState(false);
  const fmtD = (x) => (x ? new Date(x).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }) : "—");
  return (
    <>
      <Tr sx={{ "&:hover": { bgcolor: "transparent" } }}>
        <Td colSpan={13} sx={{ bgcolor: "rgba(79,70,229,0.06)", borderTop: "2px solid rgba(79,70,229,0.18)", py: 1 }}>
          {/* Row 1 — trip identity */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25, fontSize: 13 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 700, color: "#4338ca" }}>
              <Truck size={16} /> {g.shipmentNo ? `Shipment ${g.shipmentNo}` : "Single load (no shipment no)"}
            </Box>
            <Badge tone="indigo">{g.pumps} pump{multi ? "s" : ""}</Badge>
            <Box component="span" sx={{ color: "text.secondary" }}>{g.cargo.toLocaleString("en-IN")} L cargo</Box>
            <Box component="span" sx={{ color: "text.secondary" }}>· farthest <b>{g.maxRtkm}</b> km{multi ? " (RTKM used for oil)" : ""}</Box>
            <Box sx={{ ml: "auto" }}>
              <Button size="sm" variant="ghost" Icon={Plus} onClick={onAddExtra}
                sx={{ borderRadius: 999, px: 1.25, py: 0.25, fontSize: 12, fontWeight: 600, color: "#2563eb", bgcolor: "rgba(37,99,235,0.08)", "&:hover": { bgcolor: "rgba(37,99,235,0.16)" } }}>
                Extra oil
              </Button>
            </Box>
          </Box>

          {/* Row 2 — spend calc (diesel + meal + tolls = spend) … freight on the right */}
          <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, fontSize: 13 }}>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600, color: "#2563eb" }}>
              <Fuel size={15} /> {g.oil} L{g.extraL > 0 ? <Box component="span" sx={{ color: "#e11d48" }}>{` +${g.extraL}`}</Box> : null} · {rupee(g.oilCost + g.extraCost)}
            </Box>
            {g.meal > 0 && <><Plus size={11} color="#94a3b8" /><Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600, color: "#0ea5e9" }}><Wallet size={14} /> {rupee(g.meal)} meal</Box></>}
            {fastag && fastag.toll > 0 && (
              <>
                <Plus size={11} color="#94a3b8" />
                <Box component="button" onClick={() => setTollsOpen(true)}
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, border: "none", bgcolor: "transparent", cursor: "pointer", p: 0, font: "inherit", fontWeight: 600, color: "#7c3aed", "&:hover": { textDecoration: "underline" } }}
                  title={`${fastag.count} toll pass${fastag.count === 1 ? "" : "es"} — click for breakup`}>
                  <Toll size={15} /> {rupee(fastag.toll)} tolls
                </Box>
              </>
            )}
            <Box component="span" sx={{ color: "text.disabled", fontWeight: 700, mx: 0.25 }}>=</Box>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 700, color: "#e11d48", bgcolor: "rgba(225,29,72,0.08)", borderRadius: 999, px: 1, py: 0.25 }}
              title="Trip spend = diesel + extra oil + meal allowance + tolls">
              <TrendingDown size={14} /> {rupee(g.oilCost + g.extraCost + g.meal + (fastag?.toll || 0))} spend
            </Box>
            <Box component="span" sx={{ ml: "auto", display: "inline-flex", alignItems: "center", gap: 0.75 }}>
              <Box component="span" sx={{ fontSize: 11, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.4 }}>Freight</Box>
              <Box component="span" sx={{ fontWeight: 700, color: "success.main" }}>{rupee(g.freight)}</Box>
            </Box>
          </Box>
        </Td>
      </Tr>
      {g.loads.map((l) => (
        <Tr key={l.id}>
          <Td sx={{ whiteSpace: "nowrap" }}>{(l.invoiceDate || l.loadDate) ? new Date(l.invoiceDate || l.loadDate).toLocaleDateString("en-IN") : "—"}</Td>
          <Td sx={{ fontWeight: 500, color: "text.primary" }}>
            {l.invoiceNumber || "—"}
            {!l.hasInvoice && <Box sx={{ mt: 0.25 }}><Badge tone="yellow">invoice pending</Badge></Box>}
          </Td>
          <Td>
            <Box sx={{ fontWeight: 600, color: "text.primary", lineHeight: 1.2 }}>{l.cmsCode || "—"}</Box>
            <Box sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.2 }}>{l.roName || "—"}</Box>
          </Td>
          <Td>
            <Box sx={{ fontWeight: 600, color: "text.primary", lineHeight: 1.2 }}>{l.truckReg || "—"}</Box>
            <Box sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.2 }}>{l.driverName || "—"}</Box>
          </Td>
          <Td>{l.loadQtyL || 0}</Td>
          <Td>{l.deliveredQtyL || 0}</Td>
          <Td>{l.shortageL ? <Box component="span" sx={{ color: "error.main", fontWeight: 500 }}>{l.shortageL}</Box> : "0"}</Td>
          <Td>{l.rtkm || 0}</Td>
          <Td>{l.freightRate ? l.freightRate.toFixed(4) : "—"}</Td>
          <Td sx={{ fontWeight: 600 }}>{rupee(l.freightAmount)}</Td>
          <Td sx={{ fontWeight: 600, color: "success.main" }}>{l.netReceived ? rupee(l.netReceived) : "—"}</Td>
          <Td sx={{ whiteSpace: "nowrap", color: l.paidDate ? "text.primary" : "text.disabled" }}>{l.paidDate ? new Date(l.paidDate).toLocaleDateString("en-IN") : "—"}</Td>
          <Td><Badge tone={l.settlementStatus === "settled" ? "green" : "yellow"}>{l.settlementStatus}</Badge></Td>
        </Tr>
      ))}
      {g.extraEntries.map((e) => (
        <Tr key={e.id} sx={{ "&:hover": { bgcolor: "transparent" } }}>
          <Td colSpan={13} sx={{ bgcolor: "rgba(225,29,72,0.04)", py: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, fontSize: 13, pl: 2 }}>
              <Fuel size={14} color="#e11d48" />
              <Box component="span" sx={{ fontWeight: 700, color: "#e11d48" }}>+{e.litres} L extra</Box>
              <Badge tone="rose">{reasonLabel(e.reason)}</Badge>
              {e.driverName ? <Box component="span" sx={{ color: "text.secondary" }}>{e.driverName}</Box> : null}
              <Box component="span" sx={{ color: "text.disabled" }}>{e.date ? new Date(e.date).toLocaleDateString("en-IN") : ""}</Box>
              {e.notes ? <Box component="span" sx={{ color: "text.secondary", fontStyle: "italic" }}>“{e.notes}”</Box> : null}
              {e.cost ? <Box component="span" sx={{ color: "text.secondary" }}>{rupee(e.cost)}</Box> : null}
              <Box component="span" sx={{ ml: "auto" }}><IconButton Icon={Trash2} label="Remove" tone="rose" onClick={() => onRemoveExtra(e.id)} /></Box>
            </Box>
          </Td>
        </Tr>
      ))}
      {tollsOpen && fastag && (
        <Modal title={`FASTag tolls — ${g.shipmentNo ? `Shipment ${g.shipmentNo}` : "this trip"}`} onClose={() => setTollsOpen(false)}>
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 1.5 }}>
            {fastag.count} toll pass{fastag.count === 1 ? "" : "es"} on <b>{g.loads[0].truckReg || g.loads[0].vehicleNo || "this tanker"}</b>, matched to this trip by date · <b>{rupee(fastag.toll)}</b> total.
          </Typography>
          <Table head={["Date", "Plaza", "Amount"]}>
            {(fastag.items || []).map((it, i) => (
              <Tr key={i}>
                <Td sx={{ whiteSpace: "nowrap" }}>{fmtD(it.date)}</Td>
                <Td sx={{ color: "text.secondary" }}>{it.plaza}</Td>
                <Td sx={{ fontWeight: 600 }}>{rupee(it.amount)}</Td>
              </Tr>
            ))}
          </Table>
          <Typography sx={{ mt: 1.5, fontSize: 11.5, color: "text.disabled" }}>Tolls have no invoice link in BlackBuck statements, so they're attributed to the trip that was running on each toll&apos;s date.</Typography>
        </Modal>
      )}
    </>
  );
}

function ExtraOilModal({ group, transportId, onClose, onSaved }) {
  const lead = group.lead || group.loads[0];
  const [f, setF] = useState({ litres: "", reason: "breakdown", ratePerL: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!(Number(f.litres) > 0)) return;
    setBusy(true);
    try {
      await api("/api/extra-oil", { method: "POST", body: {
        transportId, loadId: lead.id, shipmentNo: group.shipmentNo, invoiceNumber: lead.invoiceNumber,
        litres: Number(f.litres), reason: f.reason, ratePerL: Number(f.ratePerL) || 0, notes: f.notes,
      } });
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Add extra oil" onClose={onClose}>
      <Box sx={{ mb: 2, borderRadius: 3, bgcolor: "rgba(79,70,229,0.06)", px: 2, py: 1.5, fontSize: 14 }}>
        <Box sx={{ fontWeight: 700, color: "#4338ca" }}>{group.shipmentNo ? `Shipment ${group.shipmentNo}` : `Invoice ${lead.invoiceNumber || "—"}`}</Box>
        <Box sx={{ color: "text.secondary", mt: 0.25 }}>{lead.truckReg || "—"} · {lead.driverName || "no driver"} · {group.pumps} pump{group.pumps > 1 ? "s" : ""} · planned {group.oil} L</Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.5 }}>
        <Field label="Extra litres"><Input type="number" value={f.litres} onChange={set("litres")} placeholder="e.g. 20" autoFocus /></Field>
        <Field label="Reason"><Select value={f.reason} onChange={set("reason")}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Diesel rate (₹/L, optional)"><Input type="number" value={f.ratePerL} onChange={set("ratePerL")} /></Field>
        <Field label="Notes (optional)"><Input value={f.notes} onChange={set("notes")} placeholder="What happened" /></Field>
      </Box>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !(Number(f.litres) > 0)}>Save</Button>
      </Box>
    </Modal>
  );
}
