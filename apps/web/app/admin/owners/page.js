"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import { Card, Table, Td, Tr, Badge, Button } from "@/components/ui";
import { useAdminGate } from "@/lib/useAdminGate";

export default function Owners() {
  const { loading, isAdmin } = useAdminGate();
  const [owners, setOwners] = useState([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/owners");
    if (r.ok) setOwners((await r.json()).owners || []);
  }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (loading) return <Typography sx={{ color: "text.disabled" }}>Loading…</Typography>;
  if (!isAdmin)
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography sx={{ mb: 2, color: "text.secondary" }}>You must sign in as an admin.</Typography>
        <Button component={Link} href="/admin/signin">Go to sign in</Button>
      </Card>
    );

  async function toggle(o) {
    const action = o.status === "active" ? "disable" : "enable";
    await fetch(`/api/admin/owners/${o.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    load();
  }

  return (
    <Box>
      <Typography component="h1" sx={{ mb: 2.5, fontSize: 24, fontWeight: 700, color: "text.primary" }}>Transport owners</Typography>
      <Table head={["Name", "Phone", "Trucks", "Loads", "Status", ""]}>
        {owners.map((o) => (
          <Tr key={o.id}>
            <Td sx={{ fontWeight: 500 }}>{o.name}</Td>
            <Td>{o.phone}</Td>
            <Td>{o.trucks}</Td>
            <Td>{o.loads}</Td>
            <Td>
              <Badge tone={o.status === "active" ? "green" : "red"}>{o.status}</Badge>
            </Td>
            <Td sx={{ textAlign: "right" }}>
              <Button variant="ghost" onClick={() => toggle(o)} sx={{ fontWeight: 600, color: o.status === "active" ? "error.main" : "success.main" }}>
                {o.status === "active" ? "Disable" : "Enable"}
              </Button>
            </Td>
          </Tr>
        ))}
        {owners.length === 0 && <Tr><Td colSpan={6} sx={{ p: 3, textAlign: "center", color: "text.disabled" }}>No owners yet.</Td></Tr>}
      </Table>
    </Box>
  );
}
