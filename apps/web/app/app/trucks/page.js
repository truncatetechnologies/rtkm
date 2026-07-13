"use client";
import { useState } from "react";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Button, Modal, Field, Input, Select, Badge, IconButton, useConfirm, PageLoader, SkeletonPage } from "@/components/ui";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Plus, Pencil, Trash2, RefreshCw, Download } from "@/components/icons";

const EMPTY = { type: "tanker", name: "", registrationNo: "", capacity: "", averageKmL: 4, assignedDriverId: "" };

// Government documents we track from the VAHAN record, in display order.
const DOCS = [
  ["insuranceUpto", "Insurance"],
  ["fitnessUpto", "Fitness / RC"],
  ["puccUpto", "Pollution (PUCC)"],
  ["permitUpto", "Permit"],
  ["taxUpto", "Road tax"],
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtAgo = (d) => {
  if (!d) return "never";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

// Expiry → status bucket (mirrors lib/services/vahanSync.docStatus, client-side).
function docStatus(expiry, soonDays = 30) {
  if (!expiry) return { key: "unknown", tone: "gray", label: "—" };
  const d = new Date(expiry);
  if (isNaN(d)) return { key: "unknown", tone: "gray", label: "—" };
  const daysLeft = Math.round((d.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return { key: "expired", tone: "red", label: "Expired" };
  if (daysLeft <= soonDays) return { key: "soon", tone: "yellow", label: `${daysLeft}d left` };
  return { key: "ok", tone: "green", label: "Valid" };
}

// Worst document status for the card header chip.
function truckHealth(rc) {
  if (!rc || rc.status === "never") return null;
  let expired = 0, soon = 0;
  for (const [k] of DOCS) {
    const s = docStatus(rc[k]).key;
    if (s === "expired") expired++;
    else if (s === "soon") soon++;
  }
  if (expired) return { tone: "red", label: `${expired} expired` };
  if (soon) return { tone: "yellow", label: `${soon} expiring` };
  return { tone: "green", label: "All valid" };
}

export default function Trucks() {
  const { activeId } = useApp();
  const { data: trucksData, mutate: mutateTrucks, isLoading: loadingTrucks } = useApi(activeId ? `/api/trucks?transportId=${activeId}` : null);
  const { data: driversData } = useApi(activeId ? `/api/members?transportId=${activeId}&role=driver` : null);
  const trucks = trucksData?.trucks || [];
  const drivers = driversData?.members || [];
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(null); // truck id being synced, or "all"
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
  async function syncVahan(t) {
    if (!t.registrationNo) { alert("Add a registration number for this truck first."); return; }
    setSyncing(t.id);
    try { await api(`/api/trucks/${t.id}/vahan-sync`, { method: "POST" }); }
    catch (e) { alert(`VAHAN sync failed: ${e.message || e}`); }
    finally { setSyncing(null); await mutateTrucks(); }
  }
  async function syncAll() {
    setSyncing("all");
    try {
      for (const t of trucks) {
        if (!t.registrationNo) continue;
        try { await api(`/api/trucks/${t.id}/vahan-sync`, { method: "POST" }); } catch { /* keep going */ }
      }
    } finally { setSyncing(null); await mutateTrucks(); }
  }
  function downloadRecord(t) {
    const record = { registrationNo: t.registrationNo, fetchedAt: t.rc?.fetchedAt, source: `VAHAN via ${t.rc?.provider || "provider"}`, ...t.rc };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `RC-${(t.registrationNo || t.id).replace(/\s/g, "")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";

  if (!activeId) return <Card>Select or create a transport first.</Card>;
  if (loadingTrucks && !trucksData) return <SkeletonPage cols={5} />;

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
        {trucks.length > 0 && (
          <Button variant="secondary" Icon={RefreshCw} onClick={syncAll} disabled={syncing === "all"}>
            {syncing === "all" ? "Syncing…" : "Sync all from VAHAN"}
          </Button>
        )}
        <Button Icon={Plus} onClick={() => setEditing({ ...EMPTY })}>Add truck</Button>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(3,1fr)" } }}>
        {trucks.map((t) => {
          const rc = t.rc;
          const health = truckHealth(rc);
          const isSyncing = syncing === t.id;
          return (
            <Card key={t.id} className="animate-rise">
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>{t.name || t.registrationNo}</Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {health && <Badge tone={health.tone}>{health.label}</Badge>}
                  <Badge tone={t.type === "tanker" ? "blue" : "gray"}>{t.type}</Badge>
                </Box>
              </Box>
              <Box sx={{ fontSize: 14, color: "text.secondary" }}>{t.registrationNo || "no reg. no."}</Box>
              <Box sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>Mileage: <b>{t.averageKmL}</b> km/L · Driver: {driverName(t.assignedDriverId)}</Box>

              {/* Government documents + expiry (from VAHAN) */}
              <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: "rgba(79,70,229,0.04)", border: "1px solid rgba(79,70,229,0.10)" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "text.secondary" }}>Documents</Typography>
                  <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
                    {rc?.status === "ok" ? `synced ${fmtAgo(rc.fetchedAt)}` : rc?.status === "error" ? "sync failed" : "not synced"}
                  </Typography>
                </Box>
                {rc?.status === "ok" ? (
                  <>
                    {DOCS.map(([key, label]) => {
                      const st = docStatus(rc[key]);
                      return (
                        <Box key={key} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.4 }}>
                          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontSize: 13, color: "text.primary" }}>{fmtDate(rc[key])}</Typography>
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </Box>
                        </Box>
                      );
                    })}
                    {(rc.ownerName || rc.makerModel) && (
                      <Typography sx={{ mt: 0.75, fontSize: 12, color: "text.disabled" }}>
                        {[rc.makerModel, rc.ownerName].filter(Boolean).join(" · ")}
                      </Typography>
                    )}
                  </>
                ) : rc?.status === "error" ? (
                  <Typography sx={{ fontSize: 12.5, color: "error.main" }}>{rc.error || "Could not fetch record."}</Typography>
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: "text.disabled" }}>Tap “Sync VAHAN” to pull insurance, fitness, pollution, permit &amp; tax expiry from the government portal.</Typography>
                )}
              </Box>

              <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
                <IconButton Icon={Pencil} label="Edit" tone="indigo" onClick={() => setEditing({ ...t, assignedDriverId: t.assignedDriverId || "" })} />
                <IconButton Icon={Trash2} label="Delete" tone="rose" onClick={() => remove(t.id)} />
                <Button size="sm" variant="secondary" Icon={RefreshCw} onClick={() => syncVahan(t)} disabled={isSyncing}>
                  {isSyncing ? "Syncing…" : "Sync VAHAN"}
                </Button>
                {rc?.status === "ok" && (
                  <Button size="sm" variant="secondary" Icon={Download} onClick={() => downloadRecord(t)}>Download</Button>
                )}
              </Box>
            </Card>
          );
        })}
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
