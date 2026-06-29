"use client";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Button, Input, Select, Field } from "@/components/ui";
import { AlertTriangle, Truck, CheckCircle2 } from "@/components/icons";
import { api } from "@/lib/clientApi";

// Shown after an upload to flag data-integrity gaps and offer one-click fixes:
//  - Statement / bank advice → invoices that have no source Tax Invoice uploaded yet.
//  - Invoice → a tanker not in the fleet, or no driver assigned (with add/assign shortcuts).
export default function UploadValidation({ result, activeId }) {
  const v = result?.validation;
  if (!v) return null;

  const missing = v.missingInvoices || [];
  const isInvoice = result.kind === "invoice";

  return (
    <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
      {missing.length > 0 && (
        <Box sx={{ borderRadius: 3, bgcolor: "rgba(245,158,11,0.10)", px: 2, py: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 600, color: "#b45309" }}>
            <AlertTriangle size={18} /> Imported — but {missing.length} {result.kind === "payment" ? "payment line(s)" : "delivery(ies)"} have no Invoice yet
          </Box>
          <Typography sx={{ mt: 0.5, fontSize: 13, color: "#92400e" }}>
            {result.kind === "payment"
              ? "These bank lines didn't match any delivery: "
              : "Saved and marked “invoice pending” in the Statement of Freight — driver & full details stay incomplete until you upload the Tax Invoice for: "}
            <b>{missing.join(", ")}</b>. {result.kind === "payment" ? "Upload the matching Invoice/Statement first." : "Open Statement of Freight to see the pending list."}
          </Typography>
        </Box>
      )}

      {isInvoice && (v.needsTruck || v.needsDriver) && (
        <InvoiceMasterFix v={v} activeId={activeId} />
      )}
    </Box>
  );
}

function InvoiceMasterFix({ v, activeId }) {
  const { mutate } = useSWRConfig();
  const [truckId, setTruckId] = useState(null);
  const [truckAdded, setTruckAdded] = useState(!v.needsTruck); // already in fleet → go straight to driver
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState("");
  const [addNew, setAddNew] = useState(false);
  const [nd, setNd] = useState({ name: v.driverName || "", phone: "", pin: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  const needDriverStep = v.needsDriver || v.needsTruck; // after a new tanker, also wants a driver

  // Revalidate every cached endpoint so the new truck/driver shows in the master lists at once.
  const refreshAll = () => mutate(() => true);

  // Load existing drivers once we reach the driver step.
  useEffect(() => {
    if (truckAdded && needDriverStep && !drivers.length) {
      api(`/api/members?transportId=${activeId}&role=driver`).then((d) => setDrivers(d.members || [])).catch(() => {});
    }
  }, [truckAdded, needDriverStep, activeId, drivers.length]);

  async function addTruck() {
    setBusy(true); setErr("");
    try {
      const r = await api("/api/trucks", { method: "POST", body: { transportId: activeId, registrationNo: v.truckReg, type: "tanker" } });
      setTruckId(r.truck.id); setTruckAdded(true); await refreshAll();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  async function assignExisting() {
    if (!driverId) return;
    setBusy(true); setErr("");
    try {
      const tid = truckId || (await findTruckId());
      if (tid) await api(`/api/trucks/${tid}`, { method: "PUT", body: { assignedDriverId: driverId } });
      await refreshAll();
      setDone("Driver assigned to the tanker. ✓");
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  async function addAndAssign() {
    if (!nd.name || !nd.phone || !nd.pin) return;
    setBusy(true); setErr("");
    try {
      const m = await api("/api/members", { method: "POST", body: { transportId: activeId, role: "driver", ...nd } });
      const tid = truckId || (await findTruckId());
      if (tid) await api(`/api/trucks/${tid}`, { method: "PUT", body: { assignedDriverId: m.member.id } });
      await refreshAll();
      setDone(`Driver “${m.member.name}” added & assigned. ✓`);
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  // The tanker may already exist in the fleet (needsDriver case) — find it by registration.
  async function findTruckId() {
    const { trucks } = await api(`/api/trucks?transportId=${activeId}`);
    const norm = (r) => String(r || "").replace(/\s/g, "").toUpperCase();
    return trucks.find((t) => norm(t.registrationNo) === norm(v.truckReg))?.id || null;
  }

  if (done) return <Box sx={{ borderRadius: 3, bgcolor: "rgba(16,185,129,0.10)", px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1, fontSize: 14, color: "success.main" }}><CheckCircle2 size={18} /> {done}</Box>;

  return (
    <Box sx={{ borderRadius: 3, bgcolor: "rgba(79,70,229,0.06)", px: 2, py: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 600, color: "#4338ca" }}>
        <Truck size={18} /> Set up this trip's tanker &amp; driver
      </Box>

      {!truckAdded && (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Tanker <b>{v.truckReg}</b> from this invoice isn't in your fleet yet.</Typography>
          <Button size="sm" onClick={addTruck} disabled={busy} sx={{ mt: 1 }}>Add tanker {v.truckReg}</Button>
        </Box>
      )}

      {truckAdded && needDriverStep && (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Assign a driver to <b>{v.truckReg}</b>{v.driverName ? ` (invoice driver: ${v.driverName})` : ""}.</Typography>
          {!addNew ? (
            <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 1 }}>
              <Box sx={{ minWidth: 180 }}><Field label="Existing driver"><Select value={driverId} onChange={(e) => setDriverId(e.target.value)}><option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field></Box>
              <Button size="sm" onClick={assignExisting} disabled={busy || !driverId}>Assign</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddNew(true)}>+ New driver</Button>
            </Box>
          ) : (
            <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1 }}>
              <Field label="Name"><Input value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} /></Field>
              <Field label="Phone"><Input value={nd.phone} onChange={(e) => setNd({ ...nd, phone: e.target.value })} /></Field>
              <Field label="PIN"><Input value={nd.pin} onChange={(e) => setNd({ ...nd, pin: e.target.value })} /></Field>
              <Box sx={{ gridColumn: "span 3", display: "flex", gap: 1 }}>
                <Button size="sm" onClick={addAndAssign} disabled={busy || !nd.name || !nd.phone || !nd.pin}>Add &amp; assign</Button>
                <Button size="sm" variant="ghost" onClick={() => setAddNew(false)}>Cancel</Button>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {err && <Typography sx={{ mt: 1, fontSize: 12.5, color: "error.main" }}>{err}</Typography>}
    </Box>
  );
}
