"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Fuel, Gauge, MapPin, Search, Plus, ChevronDown, Navigation2, Building2, X, LogIn } from "@/components/icons";
import { DEPOTS, AVERAGES, calcOilFixed } from "@rtkm/shared";
import { useI18n } from "@/lib/i18n";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function Calculator() {
  const { lang, setLang, t } = useI18n();
  const [depot, setDepot] = useState(DEPOTS[0].slug);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [average, setAverage] = useState(4);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    const d = localStorage.getItem("rtkm-depot");
    const a = localStorage.getItem("rtkm-average");
    const p = localStorage.getItem("rtkm-price");
    if (d) setDepot(d);
    if (a) setAverage(parseFloat(a));
    if (p) setPrice(p);
  }, []);
  useEffect(() => { localStorage.setItem("rtkm-depot", depot); }, [depot]);
  useEffect(() => { localStorage.setItem("rtkm-average", String(average)); }, [average]);
  useEffect(() => { localStorage.setItem("rtkm-price", price); }, [price]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pumps?depot=${encodeURIComponent(depot)}&q=${encodeURIComponent(query)}&limit=20`);
        const data = await res.json();
        setResults(data.pumps || []); setOpen(true);
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [query, depot]);

  const oil = useMemo(() => (selected ? calcOilFixed(selected.rtkm, average) : "0.00"), [selected, average]);
  const priceNum = parseFloat(price) || 0;
  const total = selected && priceNum > 0 ? Math.round((parseFloat(oil) || 0) * priceNum) : null;
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const mapsUrl = selected && selected.lat != null && selected.lng != null
    ? `https://www.google.com/maps?q=${selected.lat},${selected.lng}` : null;

  function choose(p) { setSelected(p); setQuery(p.roName); setOpen(false); }

  const fieldSx = {
    width: "100%",
    appearance: "none",
    borderRadius: 3,
    border: "1px solid",
    borderColor: "rgba(203,213,225,0.8)",
    bgcolor: "rgba(255,255,255,0.7)",
    py: 1.5,
    pl: "44px",
    pr: "40px",
    fontSize: 16,
    color: "text.primary",
    outline: "none",
    "&::placeholder": { color: "text.disabled" },
    "&:focus": { borderColor: "primary.light", boxShadow: "0 0 0 2px rgba(79,70,229,0.12)" },
  };

  return (
    <Box component="main" sx={{ minHeight: "100vh", pb: 6 }}>
      {/* Compact gradient header */}
      <Box component="header" sx={{ backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)", px: { xs: 1.5, sm: 2 }, pb: 2, pt: 3, boxShadow: "0 10px 24px -8px rgba(79,70,229,0.2)" }}>
        <Box sx={{ mx: "auto", display: "flex", maxWidth: 576, alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "nowrap" }}>
          {/* Brand — the only shrinkable zone; clips so the right cluster never gets squeezed */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
            <Box component="span" sx={{ display: "flex", flexShrink: 0, height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(255,255,255,0.2)" }}>
              <Fuel size={20} color="#fff" />
            </Box>
            <Box sx={{ lineHeight: 1.1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>RTKM</Typography>
              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: { xs: "none", sm: "block" } }}>{t("tagline")}</Typography>
            </Box>
          </Box>
          {/* Right cluster — rigid (flexShrink:0) so nothing here can wrap */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <Box sx={{ display: "flex", alignItems: "stretch", height: 40, overflow: "hidden", borderRadius: 2, bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
              {["en", "hi"].map((l) => (
                <Box component="button" key={l} onClick={() => setLang(l)}
                  sx={{
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    px: 1.5,
                    py: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    minWidth: 0,
                    ...(lang === l ? { bgcolor: "#fff", color: "primary.dark" } : { bgcolor: "transparent", color: "#fff" }),
                  }}>
                  {l === "en" ? "EN" : "हिं"}
                </Box>
              ))}
            </Box>
            {/* Login — always labeled (rigid cluster + clipping brand keep it on one line down to ~300px) */}
            <Box component={Link} href="/login" aria-label={t("ownerLogin")}
              sx={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
                flexShrink: 0, whiteSpace: "nowrap", borderRadius: 2, bgcolor: "#fff",
                height: 40, px: 1.75, py: 0,
                fontSize: 14, fontWeight: 700, color: "primary.dark", textDecoration: "none",
                boxShadow: "0 4px 12px -4px rgba(15,23,42,0.25)", "&:hover": { bgcolor: "rgba(255,255,255,0.92)" },
              }}>
              <LogIn size={18} />
              <Box component="span" sx={{ whiteSpace: "nowrap" }}>{t("ownerLogin")}</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mx: "auto", maxWidth: 576, px: 2 }}>
        {/* Main glass card */}
        <Box component="section" className="glass" sx={{ mt: 2.5, borderRadius: 4, p: 2.5, boxShadow: "0 16px 40px -16px rgba(15,23,42,0.05)" }}>
          <StepLabel n="1">{t("depot")}</StepLabel>
          <Box sx={{ position: "relative" }}>
            <Building2 size={20} color="#6366f1" style={{ pointerEvents: "none", position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <Box component="select" value={depot} onChange={(e) => { setDepot(e.target.value); setSelected(null); setQuery(""); }}
              sx={{ ...fieldSx, fontWeight: 500 }}>
              {DEPOTS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Box>
            <ChevronDown size={20} color="#94a3b8" style={{ pointerEvents: "none", position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }} />
          </Box>

          <Box sx={{ height: 20 }} />
          <StepLabel n="2">{t("pump")}</StepLabel>
          <Box sx={{ position: "relative" }}>
            <Search size={20} color="#94a3b8" style={{ pointerEvents: "none", position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <Box component="input" value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              onFocus={() => results.length && setOpen(true)} placeholder={t("startTyping")}
              sx={fieldSx} />
            {selected && (
              <Box component="button" onClick={() => { setSelected(null); setQuery(""); }} sx={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: "none", bgcolor: "transparent", cursor: "pointer", color: "text.disabled", "&:hover": { color: "text.secondary" } }}>
                <X size={20} />
              </Box>
            )}
            {open && results.length > 0 && (
              <Box component="ul" className="glass-strong" sx={{ position: "absolute", zIndex: 10, mt: 1, maxHeight: 288, width: "100%", overflow: "auto", borderRadius: 3, p: 0.5, m: 0, listStyle: "none", boxShadow: 6 }}>
                {results.map((p) => (
                  <Box component="li" key={p.id} onClick={() => choose(p)}
                    sx={{ display: "flex", cursor: "pointer", alignItems: "center", gap: 1.5, borderRadius: 2, px: 1.5, py: 1.25, "&:hover": { bgcolor: "rgba(79,70,229,0.08)" } }}>
                    <Box component="span" sx={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 2, bgcolor: "rgba(79,70,229,0.08)" }}><Fuel size={16} color="#4f46e5" /></Box>
                    <Box component="span" sx={{ minWidth: 0, flex: 1 }}>
                      <Typography component="span" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "text.primary" }}>{p.roName}</Typography>
                      <Typography component="span" sx={{ display: "block", fontSize: 12, color: "text.secondary" }}>{p.cmsCode} · {p.rtkm} {t("km")}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
          <Box component="button" onClick={() => setShowSubmit(true)} sx={{ mt: 1.25, display: "inline-flex", alignItems: "center", gap: 0.75, border: "none", bgcolor: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "primary.main", "&:hover": { color: "primary.dark" } }}>
            <Plus size={16} /> {t("addMissing")}
          </Box>

          <Box sx={{ height: 20 }} />
          <StepLabel n="3">{t("mileage")}</StepLabel>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {AVERAGES.map((a) => (
              <Box component="button" key={a} onClick={() => setAverage(a)}
                sx={{
                  minWidth: 52,
                  borderRadius: "999px",
                  border: "1px solid",
                  px: 2,
                  py: 1,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  ...(average === a
                    ? { borderColor: "primary.main", bgcolor: "primary.main", color: "#fff", boxShadow: "0 2px 6px rgba(79,70,229,0.25)" }
                    : { borderColor: "rgba(226,232,240,1)", bgcolor: "rgba(255,255,255,0.7)", color: "text.secondary", "&:hover": { borderColor: "primary.light" } }),
                }}>
                {a}
              </Box>
            ))}
          </Box>

          <Box sx={{ height: 20 }} />
          <StepLabel n="4">{t("dieselPrice")}</StepLabel>
          <Box sx={{ position: "relative" }}>
            <Box component="span" sx={{ pointerEvents: "none", position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18, fontWeight: 700, color: "#6366f1" }}>₹</Box>
            <Box component="input" value={price} onChange={(e) => setPrice(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01"
              placeholder={t("pricePlaceholder")} sx={fieldSx} />
          </Box>
        </Box>

        {/* Result */}
        <Box component="section" className="glass" sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2, borderRadius: 4, p: 2.5, boxShadow: "0 16px 40px -16px rgba(15,23,42,0.05)" }}>
          <Box component="span" sx={{ display: "flex", height: 48, width: 48, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "rgba(79,70,229,0.08)" }}><Fuel size={24} color="#4f46e5" /></Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>{t("diesel")}</Typography>
            {!selected && <Typography sx={{ fontSize: 12, color: "text.disabled" }}>{t("pickPumpHint") || "Pick a pump"}</Typography>}
          </Box>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5 }}>
            <Typography component="span" sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: "primary.main" }}>{oil}</Typography>
            <Typography component="span" sx={{ mb: 0.5, fontSize: 14, fontWeight: 700, color: "text.secondary" }}>{t("litre")}</Typography>
          </Box>
        </Box>

        {/* Total amount = diesel litres × price */}
        <Box component="section" sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2, borderRadius: 4, p: 2.5, border: "1px solid", borderColor: total != null ? "rgba(16,185,129,0.35)" : "rgba(203,213,225,0.6)", backgroundImage: total != null ? "linear-gradient(135deg,rgba(16,185,129,0.10),rgba(5,150,105,0.06))" : "none", bgcolor: total != null ? "transparent" : "rgba(255,255,255,0.6)", boxShadow: "0 16px 40px -16px rgba(15,23,42,0.05)" }}>
          <Box component="span" sx={{ display: "flex", height: 48, width: 48, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: total != null ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.14)", fontSize: 22, fontWeight: 800, color: total != null ? "#059669" : "#94a3b8" }}>₹</Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>{t("totalAmount")}</Typography>
            {total == null && <Typography sx={{ fontSize: 12, color: "text.disabled" }}>{!selected ? (t("pickPumpHint")) : t("enterPriceHint")}</Typography>}
            {total != null && <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{oil} {t("litre")} × ₹{priceNum}</Typography>}
          </Box>
          {total != null && (
            <Typography component="span" sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: "#059669", whiteSpace: "nowrap" }}>{inr(total)}</Typography>
          )}
        </Box>

        {/* Selected pump details */}
        {selected && (
          <Box component="section" className="glass" sx={{ mt: 2, borderRadius: 4, p: 2.5, boxShadow: "0 16px 40px -16px rgba(15,23,42,0.05)" }}>
            <DetailRow label={t("roCode")} value={selected.cmsCode || "--"} />
            <DetailRow label={t("rtkm")} value={`${selected.rtkm} ${t("km")}`} />
            <DetailRow label={t("city")} value={selected.city || "--"} />
            <DetailRow label={t("address")} value={selected.address || "--"} last />
            {mapsUrl ? (
              <Box component="a" href={mapsUrl} target="_blank" rel="noreferrer"
                sx={{ mt: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 3, bgcolor: "info.main", py: 1.5, fontWeight: 600, color: "#fff", textDecoration: "none", boxShadow: "0 2px 6px rgba(37,99,235,0.25)", "&:hover": { bgcolor: "info.dark" } }}>
                <Navigation2 size={20} /> {t("openMaps")}
              </Box>
            ) : (
              <Typography component="p" sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1, borderRadius: 3, bgcolor: "rgba(254,243,199,1)", px: 2, py: 1.5, fontSize: 14, color: "#b45309" }}>
                <MapPin size={16} /> {t("noCoords")}
              </Typography>
            )}
          </Box>
        )}

        <Box component="footer" sx={{ mt: 3.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
          <Box component={Link} href="/login"
            sx={{
              display: "flex", alignItems: "center", gap: 1, borderRadius: 3, border: "1px solid",
              borderColor: "rgba(79,70,229,0.35)", bgcolor: "rgba(79,70,229,0.06)", px: 2.5, py: 1.25,
              fontSize: 14, fontWeight: 600, color: "primary.main", textDecoration: "none",
              "&:hover": { bgcolor: "rgba(79,70,229,0.12)" },
            }}>
            <LogIn size={18} /> {t("loginHint")}
          </Box>
          <Link href="/admin" style={{ textDecoration: "none" }}>
            <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: "text.disabled", "&:hover": { color: "primary.main" } }}>{t("adminLogin")}</Typography>
          </Link>
        </Box>
      </Box>

      {showSubmit && <SubmitModal depot={depot} t={t} onClose={() => setShowSubmit(false)} />}
    </Box>
  );
}

function StepLabel({ n, children }) {
  return (
    <Box sx={{ mb: 1.25, display: "flex", alignItems: "center", gap: 1 }}>
      <Box component="span" sx={{ display: "flex", height: 24, width: 24, alignItems: "center", justifyContent: "center", borderRadius: "999px", bgcolor: "rgba(79,70,229,0.12)", fontSize: 12, fontWeight: 800, color: "primary.dark" }}>{n}</Box>
      <Typography component="span" sx={{ fontSize: 16, fontWeight: 700, color: "text.primary" }}>{children}</Typography>
    </Box>
  );
}

function DetailRow({ label, value, last }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.25, ...(last ? {} : { borderBottom: "1px solid", borderColor: "rgba(241,245,249,0.7)" }) }}>
      <Typography component="span" sx={{ fontSize: 14, color: "text.secondary" }}>{label}</Typography>
      <Typography component="span" sx={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", fontSize: 14, fontWeight: 600, color: "text.primary" }}>{value}</Typography>
    </Box>
  );
}

function SubmitModal({ depot, t, onClose }) {
  const [form, setForm] = useState({ depot, roName: "", cmsCode: "", rtkm: "", address: "", submittedByName: "", submittedByPhone: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/submissions", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Failed"); return; }
    setMsg(t("submittedOk")); setTimeout(onClose, 1200);
  }

  const inputSx = {
    width: "100%",
    borderRadius: 3,
    border: "1px solid",
    borderColor: "rgba(203,213,225,0.8)",
    bgcolor: "rgba(255,255,255,0.7)",
    px: 1.75,
    py: 1.25,
    fontSize: 16,
    color: "text.primary",
    outline: "none",
    "&::placeholder": { color: "text.disabled" },
    "&:focus": { borderColor: "primary.light", boxShadow: "0 0 0 2px rgba(79,70,229,0.12)" },
  };
  return (
    <Box onClick={onClose} sx={{ position: "fixed", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(15,23,42,0.4)", p: 2, backdropFilter: "blur(4px)" }}>
      <Box className="glass-strong" onClick={(e) => e.stopPropagation()} sx={{ width: "100%", maxWidth: 448, borderRadius: 4, p: 3, boxShadow: 6 }}>
        <Typography component="h2" sx={{ mb: 2, fontSize: 18, fontWeight: 700, color: "text.primary" }}>{t("addMissing")}</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          <Box component="select" value={form.depot} onChange={set("depot")} sx={inputSx}>
            {DEPOTS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
          </Box>
          <Box component="input" value={form.roName} onChange={set("roName")} placeholder={t("pump")} sx={inputSx} />
          <Box component="input" value={form.cmsCode} onChange={set("cmsCode")} placeholder={t("roCode")} sx={inputSx} />
          <Box component="input" value={form.rtkm} onChange={set("rtkm")} type="number" placeholder={t("rtkm")} sx={inputSx} />
          <Box component="input" value={form.address} onChange={set("address")} placeholder={t("address")} sx={inputSx} />
          <Box component="input" value={form.submittedByName} onChange={set("submittedByName")} placeholder={t("name")} sx={inputSx} />
          <Box component="input" value={form.submittedByPhone} onChange={set("submittedByPhone")} placeholder={t("yourPhone")} sx={inputSx} />
        </Box>
        {msg && <Typography component="p" sx={{ mt: 1, fontSize: 14, fontWeight: 500, color: "success.main" }}>{msg}</Typography>}
        <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Box component="button" onClick={onClose} sx={{ borderRadius: 3, border: "1px solid", borderColor: "rgba(226,232,240,1)", bgcolor: "transparent", cursor: "pointer", px: 2, py: 1.25, fontSize: 14, fontWeight: 600, color: "text.secondary" }}>{t("cancel")}</Box>
          <Box component="button" onClick={submit} disabled={busy} sx={{ borderRadius: 3, border: "none", bgcolor: "primary.main", cursor: "pointer", px: 2, py: 1.25, fontSize: 14, fontWeight: 600, color: "#fff", boxShadow: "0 2px 6px rgba(79,70,229,0.25)", "&:disabled": { opacity: 0.5 } }}>
            {busy ? t("sending") : t("submit")}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
