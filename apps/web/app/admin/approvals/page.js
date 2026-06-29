"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { depotName } from "@rtkm/shared";
import { Box, Typography } from "@mui/material";
import { Card, Button } from "@/components/ui";
import { useAdminGate } from "@/lib/useAdminGate";

export default function Approvals() {
  const { loading, isAdmin } = useAdminGate();
  const [subs, setSubs] = useState([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/submissions?status=pending");
    if (r.ok) setSubs((await r.json()).submissions || []);
  }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (loading) return <Typography sx={{ color: "text.disabled" }}>Loading…</Typography>;
  if (!isAdmin) return <NeedSignin />;

  async function act(id, action) {
    const reason = action === "reject" ? prompt("Reason (optional):") || "" : "";
    await fetch(`/api/admin/submissions/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }),
    });
    setMsg(action === "approve" ? "Approved." : "Rejected.");
    load();
  }

  return (
    <Box>
      <Typography component="h1" sx={{ mb: 0.5, fontSize: 24, fontWeight: 700, color: "text.primary" }}>Pending approvals</Typography>
      <Typography sx={{ mb: 2.5, fontSize: 14, color: "text.secondary" }}>Driver-submitted pumps. Approve to make them public.</Typography>
      {msg && <Typography sx={{ mb: 1.5, fontSize: 14, color: "info.main" }}>{msg}</Typography>}

      {subs.length === 0 ? (
        <Card sx={{ p: 3, textAlign: "center", color: "text.disabled" }}>Nothing pending. 🎉</Card>
      ) : (
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" } }}>
          {subs.map((s) => (
            <Card key={s.id} sx={{ p: 2 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{s.roName}</Typography>
              <Typography sx={{ fontSize: 14, color: "text.secondary" }}>{s.cmsCode} · {depotName(s.depot)} · {s.rtkm} km</Typography>
              {s.address && <Typography sx={{ mt: 0.5, fontSize: 14 }}>{s.address}</Typography>}
              {(s.submittedByName || s.submittedByPhone) && (
                <Typography sx={{ mt: 0.5, fontSize: 12, color: "text.disabled" }}>By {s.submittedByName || "—"} {s.submittedByPhone}</Typography>
              )}
              <Box sx={{ mt: 1.5, display: "flex", gap: 1 }}>
                <Button onClick={() => act(s.id, "approve")}>Approve</Button>
                <Button variant="secondary" onClick={() => act(s.id, "reject")} sx={{ borderColor: "error.light", color: "error.main", bgcolor: "transparent" }}>Reject</Button>
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

function NeedSignin() {
  return (
    <Card sx={{ p: 4, textAlign: "center" }}>
      <Typography sx={{ mb: 2, color: "text.secondary" }}>You must sign in as an admin.</Typography>
      <Button component={Link} href="/admin/signin">Go to sign in</Button>
    </Card>
  );
}
