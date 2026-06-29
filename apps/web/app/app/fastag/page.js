"use client";
import { useRef, useState } from "react";
import { useApp } from "@/lib/appContext";
import { useApi } from "@/lib/useApi";
import { uploadPdf, api } from "@/lib/clientApi";
import { Card, Table, Td, Tr, Badge, Tile, Button, Input, rupee } from "@/components/ui";
import { Box, Typography } from "@mui/material";
import { Toll, Wallet, TrendingDown, AlertTriangle, UploadCloud, CheckCircle2, Ban } from "@/components/icons";

const monthName = (m) => { if (!m) return "All time"; const [y, mo] = m.split("-"); return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }); };

export default function Fastag() {
  const { activeId } = useApp();
  const [period, setPeriod] = useState("");
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { data, mutate } = useApi(activeId ? `/api/fastag/report?transportId=${activeId}${period ? `&period=${period}` : ""}` : null);
  const d = data || { months: [], totals: {}, byTruck: [], flags: [], topPlazas: [] };
  const t = d.totals || {};

  if (!activeId) return <Card>Select or create a transport first.</Card>;

  async function onFiles(list) {
    const files = Array.from(list || []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!files.length) return;
    setBusy(true); setMsg("");
    let tag = 0, boss = 0, fail = 0, dup = 0;
    for (const f of files) {
      try {
        const r = await uploadPdf("/api/fastag/upload", f, activeId);
        if (r.duplicate) dup++; else if (r.kind === "tag") tag++; else if (r.kind === "boss") boss++; else fail++;
      } catch { fail++; }
    }
    setMsg(`Imported — ${tag} tanker statement(s), ${boss} BOSS wallet${dup ? `, ${dup} duplicate (already uploaded, skipped)` : ""}${fail ? `, ${fail} not recognised` : ""}.`);
    setBusy(false); mutate();
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Card sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
        <Box sx={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 2.5, color: "#fff", backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}><Toll size={22} /></Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>BlackBuck FASTag</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Upload the <b>BOSS wallet</b> monthly statement <b>and</b> each tanker's statement. Per-tanker tolls are the truth; the wallet is checked for extra/non-toll charges.</Typography>
        </Box>
        <Button Icon={UploadCloud} onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Reading…" : "Upload statements"}</Button>
        <input ref={inputRef} type="file" accept="application/pdf" multiple style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
      </Card>
      {msg && <Typography sx={{ fontSize: 14, color: "primary.dark" }}>{msg}</Typography>}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>Month:</Typography>
        <Box component="select" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ borderRadius: 2, border: "1px solid #e2e8f0", bgcolor: "#fff", px: 1.5, py: 0.75, fontSize: 14 }}>
          <option value="">All time</option>
          {d.months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" } }}>
        <Tile label="Tolls paid" value={t.totalToll || 0} format="rupee" Icon={Toll} tone="indigo" delay={0} />
        <Tile label="Non-toll charges" value={t.extras || 0} format="rupee" Icon={AlertTriangle} tone={t.extras > 0 ? "rose" : "green"} delay={60} />
        <Tile label="Total FASTag cost" value={t.fastagCost || 0} format="rupee" Icon={TrendingDown} tone="amber" delay={120} />
        <Tile label="Wallet top-ups" value={t.topup || 0} format="rupee" Icon={Wallet} tone="green" delay={180} />
      </Box>

      {d.flags.length > 0 && (
        <Card sx={{ borderLeft: "4px solid #f59e0b" }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#b45309", display: "flex", alignItems: "center", gap: 1 }}><AlertTriangle size={18} /> Review</Typography>
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
            {d.flags.map((f, i) => <Box component="li" key={i} sx={{ fontSize: 13.5, color: f.level === "warn" ? "error.main" : "text.secondary", mb: 0.5 }}>{f.msg}</Box>)}
          </Box>
        </Card>
      )}

      {(d.charges || []).length > 0 && <ChargesReview charges={d.charges} refunds={d.refunds || []} onChanged={mutate} />}

      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>Tolls by tanker</Typography>
      <Table head={["Tanker", "Toll passes", "Tolls paid"]}>
        {d.byTruck.map((r) => (
          <Tr key={r.vehicleNo}>
            <Td sx={{ fontWeight: 600, color: "text.primary" }}>{r.vehicleNo}</Td>
            <Td>{r.tollCount}</Td>
            <Td sx={{ fontWeight: 600 }}>{rupee(r.toll)}</Td>
          </Tr>
        ))}
        {d.byTruck.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No FASTag data yet — upload statements above.</Td></Tr>}
      </Table>

      {d.topPlazas.length > 0 && (
        <>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>Top toll plazas</Typography>
          <Table head={["Plaza", "Passes", "Total"]}>
            {d.topPlazas.map((p) => (
              <Tr key={p.plaza}><Td sx={{ color: "text.primary" }}>{p.plaza}</Td><Td>{p.count}</Td><Td sx={{ fontWeight: 600 }}>{rupee(p.amount)}</Td></Tr>
            ))}
          </Table>
        </>
      )}
    </Box>
  );
}

const STATUS = { pending: { tone: "yellow", label: "To review" }, expected: { tone: "green", label: "Expected" }, disputed: { tone: "rose", label: "Disputed" } };

function ChargesReview({ charges, refunds, onChanged }) {
  const [showExpected, setShowExpected] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);
  // Pending + disputed stay visible (both need attention); only "expected" (cleared) collapse.
  const active = charges.filter((c) => c.reviewStatus !== "expected");
  const expected = charges.filter((c) => c.reviewStatus === "expected");
  const list = showExpected ? charges : active;
  const refundTotal = refunds.reduce((s, r) => s + r.amount, 0);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>Non-toll charges — verify &amp; dispute</Typography>
        {expected.length > 0 && <Button variant="ghost" onClick={() => setShowExpected((v) => !v)} sx={{ fontSize: 12, py: 0.25 }}>{showExpected ? "Hide cleared" : `Show cleared (${expected.length})`}</Button>}
      </Box>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Each non-toll deduction with its <b>Transaction ID</b> — verify against BlackBuck. Mark <b>Expected</b> to clear it, or <b>Dispute</b> to flag a false charge (with a note for follow-up). Disputed ones stay here until you resolve them.</Typography>
      {list.map((c) => <ChargeRow key={c.id} c={c} onChanged={onChanged} />)}
      {active.length === 0 && !showExpected && <Typography sx={{ fontSize: 13, color: "success.main" }}>All non-toll charges reviewed ✓</Typography>}
      {refunds.length > 0 && (
        <Box sx={{ mt: 1, borderTop: "1px solid", borderColor: "rgba(15,23,42,0.06)", pt: 1 }}>
          <Box onClick={() => setShowRefunds((v) => !v)} sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", userSelect: "none" }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>Refunds received: <Box component="span" sx={{ color: "success.main" }}>+{rupee(refundTotal)}</Box> ({refunds.length})</Typography>
            <Typography sx={{ fontSize: 12, color: "info.main" }}>{showRefunds ? "Hide" : "Show"}</Typography>
          </Box>
          {showRefunds && (
            <Box sx={{ mt: 0.5, maxHeight: 220, overflow: "auto" }}>
              {refunds.map((r) => (
                <Box key={r.id} sx={{ display: "flex", gap: 1.5, fontSize: 12.5, color: "text.secondary", py: 0.25 }}>
                  <Box component="span" sx={{ width: 78 }}>{r.txnDate ? new Date(r.txnDate).toLocaleDateString("en-IN") : ""}</Box>
                  <Box component="span" sx={{ flex: 1 }}>{r.desc}</Box>
                  <Box component="span" sx={{ fontFamily: "monospace", fontSize: 11.5 }}>{r.txnId || "—"}</Box>
                  <Box component="span" sx={{ color: "success.main", fontWeight: 600 }}>+{rupee(r.amount)}</Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function ChargeRow({ c, onChanged }) {
  const [note, setNote] = useState(c.reviewNote || "");
  const [busy, setBusy] = useState(false);
  const st = STATUS[c.reviewStatus] || STATUS.pending;
  async function mark(status) {
    setBusy(true);
    try { await api(`/api/fastag/charge/${c.id}`, { method: "POST", body: { status, note } }); onChanged(); }
    finally { setBusy(false); }
  }
  return (
    <Card sx={{ p: 1.5, borderLeft: c.reviewStatus === "disputed" ? "4px solid #e11d48" : c.reviewStatus === "expected" ? "4px solid #10b981" : "4px solid #f59e0b" }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ minWidth: 140 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>{c.desc}{c.vehicleNo ? ` · ${c.vehicleNo}` : ""}</Typography>
          <Typography sx={{ fontSize: 12, color: "text.disabled" }}>{c.txnDate ? new Date(c.txnDate).toLocaleDateString("en-IN") : ""}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={{ fontSize: 11, color: "text.disabled" }}>Transaction ID</Typography>
          <Typography component="span" sx={{ fontFamily: "monospace", fontSize: 13, color: "text.secondary", userSelect: "all" }}>{c.txnId || "—"}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "error.main" }}>{rupee(c.amount)}</Typography>
        <Badge tone={st.tone}>{st.label}</Badge>
      </Box>
      <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 180 }}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. tag re-issue, or why it's a false charge)" /></Box>
        {c.reviewStatus === "pending" ? (
          <>
            <Button size="sm" variant="secondary" Icon={CheckCircle2} onClick={() => mark("expected")} disabled={busy}>Expected</Button>
            <Button size="sm" Icon={Ban} onClick={() => mark("disputed")} disabled={busy} sx={{ bgcolor: "#e11d48", "&:hover": { bgcolor: "#be123c" } }}>Dispute</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => mark("pending")} disabled={busy}>Undo</Button>
        )}
      </Box>
    </Card>
  );
}
