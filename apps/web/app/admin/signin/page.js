"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck, Phone, Lock } from "@/components/icons";
import { Box, Typography } from "@mui/material";
import { useAdminGate } from "@/lib/useAdminGate";

export default function SignIn() {
  const router = useRouter();
  const { isAdmin } = useAdminGate();
  const [form, setForm] = useState({ phone: "", pin: "" });
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { if (isAdmin) router.replace("/admin"); }, [isAdmin, router]);

  async function submit(e) {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/owner/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Invalid phone or PIN"); return; }
      if (data.user?.role !== "admin") { setErr("This account is not an admin."); return; }
      router.replace("/admin");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputWrapSx = {
    display: "flex", alignItems: "center", gap: 1.25, borderRadius: 3,
    border: "1px solid", borderColor: "rgba(203,213,225,0.9)", bgcolor: "rgba(255,255,255,0.8)", px: 1.75,
    transition: "border-color .15s, box-shadow .15s",
    "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(79,70,229,0.14)" },
  };
  const inputSx = { width: "100%", bgcolor: "transparent", border: "none", outline: "none", py: 1.5, color: "text.primary", fontSize: 16, "&::placeholder": { color: "text.disabled" } };

  return (
    <Box component="main" sx={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", px: 2 }}>
      <Box sx={{ width: "100%", maxWidth: 420 }} className="animate-rise">
        <Box sx={{ mb: 3, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Box component="span" sx={{ mb: 1.5, display: "flex", height: 56, width: 56, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 12px 24px -8px rgba(79,70,229,0.4)" }}>
            <ShieldCheck size={28} color="#fff" />
          </Box>
          <Typography component="h1" sx={{ fontSize: 25, fontWeight: 800, letterSpacing: "-0.02em", color: "text.primary" }}>RTKM Admin</Typography>
          <Typography sx={{ mt: 0.75, fontSize: 14.5, color: "text.secondary" }}>Sign in with your phone number and PIN.</Typography>
        </Box>

        <Box className="glass-strong" sx={{ borderRadius: 4, p: 3, boxShadow: "0 20px 45px -20px rgba(30,27,75,0.45)" }}>
          <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={inputWrapSx}>
              <Phone size={20} color="#94a3b8" />
              <Box component="input" value={form.phone} onChange={set("phone")} inputMode="numeric" placeholder="Phone number" autoComplete="username" sx={inputSx} />
            </Box>
            <Box sx={inputWrapSx}>
              <Lock size={20} color="#94a3b8" />
              <Box component="input" value={form.pin} onChange={set("pin")} inputMode="numeric" type={showPin ? "text" : "password"} placeholder="PIN" autoComplete="current-password" sx={inputSx} />
              <Box component="button" type="button" onClick={() => setShowPin((v) => !v)} sx={{ flexShrink: 0, border: "none", bgcolor: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "text.secondary", px: 0.5, "&:hover": { color: "primary.main" } }}>
                {showPin ? "Hide" : "Show"}
              </Box>
            </Box>

            {err && (
              <Box sx={{ mt: 0.5, borderRadius: 2.5, bgcolor: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.2)", px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: "error.main" }}>{err}</Typography>
              </Box>
            )}

            <Box component="button" type="submit" disabled={busy}
              sx={{ mt: 1, width: "100%", border: "none", borderRadius: 3, bgcolor: "primary.main", py: 1.5, fontWeight: 700, color: "#fff", fontSize: 16, cursor: "pointer", boxShadow: "0 8px 20px -8px rgba(79,70,229,0.55)", "&:hover": { bgcolor: "primary.dark" }, "&:disabled": { opacity: 0.55 } }}>
              {busy ? "Please wait…" : "Log in"}
            </Box>
          </Box>

          <Box sx={{ my: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ flex: 1, height: "1px", bgcolor: "rgba(15,23,42,0.1)" }} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.disabled" }}>OR</Typography>
            <Box sx={{ flex: 1, height: "1px", bgcolor: "rgba(15,23,42,0.1)" }} />
          </Box>

          <Box component="button" type="button" onClick={() => signIn("google", { callbackUrl: "/admin" })}
            sx={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 3, py: 1.5, fontWeight: 600, fontSize: 15, cursor: "pointer", color: "text.primary", bgcolor: "background.paper", border: "1px solid", borderColor: "rgba(15,23,42,0.12)", "&:hover": { bgcolor: "rgba(255,255,255,0.95)" } }}>
            Continue with Google
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
