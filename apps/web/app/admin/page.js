"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEPOTS } from "@rtkm/shared";
import { Box, Typography } from "@mui/material";
import { Button, Table, Td, Tr, Modal, Field, Input, Select } from "@/components/ui";
import { useAdminGate } from "@/lib/useAdminGate";

const EMPTY = {
  depot: DEPOTS[0].slug, cmsCode: "", roName: "", rtkm: 0,
  address: "", city: "", state: "", district: "", division: "", zone: "",
  sourceLocation: "", supplyLocationCode: "", lat: "", lng: "",
};

export default function Admin() {
  const { loading, isAdmin } = useAdminGate();

  const [depot, setDepot] = useState(""); // "" = all depots
  const [q, setQ] = useState("");
  const [data, setData] = useState({ pumps: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // pump object or EMPTY for new
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/pumps?depot=${encodeURIComponent(depot)}&q=${encodeURIComponent(q)}&page=${page}&limit=50`
    );
    setData(await res.json());
  }, [depot, q, page]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (loading) return <Centered>Loading…</Centered>;
  if (!isAdmin)
    return (
      <Centered>
        <Typography sx={{ mb: 2 }}>You must sign in as an admin.</Typography>
        <Button component={Link} href="/admin/signin" variant="blue">
          Go to sign in
        </Button>
      </Centered>
    );

  async function save(form) {
    setBusy(true); setMsg("");
    const payload = {
      ...form,
      rtkm: Number(form.rtkm) || 0,
      lat: form.lat === "" || form.lat == null ? null : Number(form.lat),
      lng: form.lng === "" || form.lng == null ? null : Number(form.lng),
    };
    const isNew = !form.id;
    const res = await fetch(isNew ? "/api/pumps" : `/api/pumps/${form.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json(); setMsg(e.error || "Save failed"); return; }
    setEditing(null); setMsg("Saved."); load();
  }

  async function remove(id) {
    if (!confirm("Delete this pump?")) return;
    await fetch(`/api/pumps/${id}`, { method: "DELETE" });
    load();
  }

  async function geocode(form, setForm) {
    if (!form.address) { setMsg("Add an address first."); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: form.address }),
    });
    setBusy(false);
    if (!res.ok) { setMsg("Geocoding failed."); return; }
    const r = await res.json();
    setForm({ ...form, lat: r.lat, lng: r.lng });
    setMsg(`Geocoded via ${r.provider}.`);
  }

  return (
    <Box>
      <Typography component="h1" sx={{ mb: 2.5, fontSize: 24, fontWeight: 700, color: "text.primary" }}>Master pumps</Typography>

      <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Select value={depot} onChange={(e) => { setDepot(e.target.value); setPage(1); }} sx={{ width: "auto", minWidth: 160 }}>
          <option value="">All depots</option>
          {DEPOTS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </Select>
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search name / CMS code (all depots)"
          sx={{ flex: 1 }} />
        <Button onClick={() => setEditing({ ...EMPTY, depot: depot || DEPOTS[0].slug })}>+ New pump</Button>
      </Box>

      {msg && <Typography sx={{ mb: 1.5, fontSize: 14, color: "info.main" }}>{msg}</Typography>}

      <Table head={["RO Name", "CMS", "RTKM", "Coords", ""]}>
        {data.pumps.map((p) => (
          <Tr key={p.id}>
            <Td sx={{ fontWeight: 500 }}>{p.roName}</Td>
            <Td sx={{ color: "text.secondary" }}>{p.cmsCode}</Td>
            <Td>{p.rtkm}</Td>
            <Td sx={{ fontSize: 12 }}>
              {p.lat != null ? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` :
                <Typography component="span" sx={{ color: "warning.main", fontSize: 12 }}>none</Typography>}
            </Td>
            <Td sx={{ textAlign: "right" }}>
              <Button variant="ghost" onClick={() => setEditing({ ...EMPTY, ...p, lat: p.lat ?? "", lng: p.lng ?? "" })}
                sx={{ mr: 1, color: "info.main" }}>Edit</Button>
              <Button variant="ghost" onClick={() => remove(p.id)} sx={{ color: "error.main" }}>Delete</Button>
            </Td>
          </Tr>
        ))}
        {data.pumps.length === 0 && (
          <Tr><Td colSpan={5} sx={{ p: 3, textAlign: "center", color: "text.disabled" }}>No pumps found.</Td></Tr>
        )}
      </Table>

      <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
        <Typography component="span" sx={{ color: "text.secondary" }}>{data.total} total</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Typography component="span" sx={{ px: 1, py: 0.5 }}>Page {data.page} / {data.pages || 1}</Typography>
          <Button variant="secondary" size="sm" disabled={page >= (data.pages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </Box>
      </Box>

      {editing && (
        <EditModal
          initial={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={save}
          onGeocode={geocode}
        />
      )}
    </Box>
  );
}

function EditModal({ initial, onCancel, onSave, onGeocode, busy }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal title={form.id ? "Edit pump" : "New pump"} onClose={onCancel}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.5 }}>
        <Field label="Depot">
          <Select value={form.depot} onChange={set("depot")}>
            {DEPOTS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="CMS Code"><Input value={form.cmsCode} onChange={set("cmsCode")} /></Field>
        <Field label="RO Name" sx={{ gridColumn: "span 2" }}><Input value={form.roName} onChange={set("roName")} /></Field>
        <Field label="RTKM"><Input type="number" value={form.rtkm} onChange={set("rtkm")} /></Field>
        <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
        <Field label="Address" sx={{ gridColumn: "span 2" }}><Input value={form.address} onChange={set("address")} /></Field>
        <Field label="Latitude"><Input value={form.lat} onChange={set("lat")} /></Field>
        <Field label="Longitude"><Input value={form.lng} onChange={set("lng")} /></Field>
      </Box>
      <Button onClick={() => onGeocode(form, setForm)} disabled={busy} sx={{ mt: 1.5, fontWeight: 500 }}>
        📍 Geocode from address
      </Button>

      <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Box>
    </Modal>
  );
}

function Centered({ children }) {
  return <Box component="main" sx={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", px: 2, textAlign: "center" }}>{children}</Box>;
}
