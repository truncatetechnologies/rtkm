"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck, Phone, Lock, User, ShieldCheck, BarChart3, Wallet, ChevronRight } from "@/components/icons";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

const FEATURES = [
  { Icon: ShieldCheck, title: "Role-based access", desc: "One secure login for owners, managers & drivers." },
  { Icon: BarChart3, title: "Live analytics", desc: "Spend, profit and toll insights, updated in real time." },
  { Icon: Wallet, title: "Money, reconciled", desc: "Salaries, shortages & FASTag matched automatically." },
];

export default function OwnerLogin() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({ name: "", phone: "", pin: "" });
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true); setErr("");
    const url = mode === "login" ? "/api/auth/owner/login" : "/api/auth/owner/register";
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Something went wrong. Try again."); return; }
      router.push(data.user?.role === "admin" ? "/admin" : "/app");
    } catch {
      setErr("Network error — check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  const inputWrapSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    borderRadius: 3,
    border: "1px solid",
    borderColor: "rgba(203,213,225,0.9)",
    bgcolor: "rgba(255,255,255,0.8)",
    px: 1.75,
    transition: "border-color .15s, box-shadow .15s",
    "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(79,70,229,0.14)" },
  };
  const inputSx = {
    width: "100%",
    bgcolor: "transparent",
    border: "none",
    outline: "none",
    py: 1.5,
    color: "text.primary",
    fontSize: 16,
    "&::placeholder": { color: "text.disabled" },
  };

  return (
    <Box component="main" sx={{ display: "flex", minHeight: "100vh" }}>
      {/* ---------- Brand showcase (desktop only) ---------- */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          position: "relative",
          overflow: "hidden",
          flex: "1 1 0",
          flexDirection: "column",
          justifyContent: "space-between",
          p: { md: 5, lg: 7 },
          color: "#fff",
          backgroundImage: "linear-gradient(150deg,#4338ca 0%,#4f46e5 45%,#7c3aed 100%)",
        }}
      >
        {/* decorative blurred orbs + dotted texture */}
        <Box aria-hidden sx={{ position: "absolute", top: -120, right: -100, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.22), transparent 65%)", filter: "blur(6px)" }} />
        <Box aria-hidden sx={{ position: "absolute", bottom: -160, left: -120, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,164,0.30), transparent 60%)" }} />
        <Box aria-hidden className="kpi-dots" sx={{ position: "absolute", inset: 0, opacity: 0.18, "--dot": "rgba(255,255,255,0.5)" }} />

        {/* logo + wordmark */}
        <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ display: "flex", height: 46, width: 46, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.4)", backdropFilter: "blur(8px)" }}>
            <Truck size={26} color="#fff" />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1 }}>RTKM</Typography>
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.75)", mt: 0.25 }}>Transport Management</Typography>
          </Box>
        </Box>

        {/* headline + features */}
        <Box sx={{ position: "relative" }} className="animate-rise">
          <Typography component="h2" sx={{ fontSize: 34, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em", maxWidth: 460 }}>
            Run your entire transport business in one place.
          </Typography>
          <Typography sx={{ mt: 1.75, fontSize: 15.5, color: "rgba(255,255,255,0.82)", maxWidth: 420 }}>
            Loads, fuel, tolls, salaries and analytics — connected and accurate, on any device.
          </Typography>

          <Box sx={{ mt: 4, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {FEATURES.map(({ Icon, title, desc }) => (
              <Box key={title} sx={{ display: "flex", alignItems: "center", gap: 1.75, borderRadius: 3, p: 1.5, bgcolor: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}>
                <Box sx={{ flexShrink: 0, display: "flex", height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.16)" }}>
                  <Icon size={20} color="#fff" />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>{title}</Typography>
                  <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.74)" }}>{desc}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ position: "relative", fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>
          © RTKM · Built for transport owners
        </Typography>
      </Box>

      {/* ---------- Form panel ---------- */}
      <Box sx={{ flex: "1 1 0", display: "flex", alignItems: "center", justifyContent: "center", px: { xs: 2.5, sm: 4 }, py: 6 }}>
        <Box sx={{ width: "100%", maxWidth: 420 }} className="animate-rise">
          {/* compact brand for mobile */}
          <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: 2.5 }}>
            <Box sx={{ display: "flex", height: 56, width: 56, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 12px 24px -6px rgba(79,70,229,0.4)" }}>
              <Truck size={28} color="#fff" />
            </Box>
          </Box>

          <Box sx={{ mb: 3, textAlign: { xs: "center", md: "left" } }}>
            <Typography component="h1" sx={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: "text.primary" }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: 14.5, color: "text.secondary" }}>
              {mode === "login"
                ? "Sign in with your phone number and PIN."
                : "Owners register here — managers & drivers are added later."}
            </Typography>
          </Box>

          <Box className="glass-strong" sx={{ borderRadius: 4, p: { xs: 2.5, sm: 3 }, boxShadow: "0 20px 45px -20px rgba(30,27,75,0.45)" }}>
            {/* segmented toggle */}
            <Box sx={{ mb: 2.5, display: "flex", borderRadius: 3, bgcolor: "rgba(15,23,42,0.05)", p: 0.5 }}>
              {[["login", "Log in"], ["register", "Register"]].map(([m, label]) => (
                <Box
                  component="button"
                  type="button"
                  key={m}
                  onClick={() => { setMode(m); setErr(""); }}
                  sx={{
                    flex: 1,
                    borderRadius: 2.25,
                    border: "none",
                    py: 1,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 700,
                    transition: "all 0.2s",
                    ...(mode === m
                      ? { bgcolor: "background.paper", color: "primary.dark", boxShadow: "0 1px 3px rgba(15,23,42,0.12)" }
                      : { bgcolor: "transparent", color: "text.secondary" }),
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>

            <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {mode === "register" && (
                <Box sx={inputWrapSx}>
                  <User size={20} color="#94a3b8" />
                  <Box component="input" value={form.name} onChange={set("name")} placeholder="Your name / company" autoComplete="name" sx={inputSx} />
                </Box>
              )}

              <Box sx={inputWrapSx}>
                <Phone size={20} color="#94a3b8" />
                <Box component="input" value={form.phone} onChange={set("phone")} inputMode="numeric" placeholder="Phone number" autoComplete="username" sx={inputSx} />
              </Box>

              <Box sx={inputWrapSx}>
                <Lock size={20} color="#94a3b8" />
                <Box component="input" value={form.pin} onChange={set("pin")} inputMode="numeric" type={showPin ? "text" : "password"} placeholder="PIN" autoComplete={mode === "login" ? "current-password" : "new-password"} sx={inputSx} />
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  sx={{ flexShrink: 0, border: "none", bgcolor: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "text.secondary", px: 0.5, "&:hover": { color: "primary.main" } }}
                >
                  {showPin ? "Hide" : "Show"}
                </Box>
              </Box>

              {err && (
                <Box sx={{ mt: 0.5, borderRadius: 2.5, bgcolor: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.2)", px: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: "error.main" }}>{err}</Typography>
                </Box>
              )}

              <Button
                type="submit"
                disabled={busy}
                variant="contained"
                disableElevation
                endIcon={!busy ? <ChevronRight size={18} color="#fff" /> : undefined}
                sx={{ mt: 1, width: "100%", borderRadius: 3, bgcolor: "primary.main", py: 1.5, fontWeight: 700, color: "#fff", textTransform: "none", fontSize: 16, boxShadow: "0 8px 20px -8px rgba(79,70,229,0.55)", "&:hover": { bgcolor: "primary.dark" }, "&:disabled": { opacity: 0.55, color: "#fff" } }}
              >
                {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
              </Button>
            </Box>

            {mode === "register" && (
              <Typography sx={{ mt: 1.75, textAlign: "center", fontSize: 12, color: "text.disabled" }}>
                Only owners self-register. Managers & drivers are added from inside the app.
              </Typography>
            )}
          </Box>

          <Link href="/" style={{ textDecoration: "none" }}>
            <Typography sx={{ mt: 2.5, display: "block", textAlign: "center", fontSize: 14, fontWeight: 600, color: "text.secondary", transition: "color .15s", "&:hover": { color: "primary.main" } }}>
              ← Back to calculator
            </Typography>
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
