"use client";
// MUI-backed UI kit. Same export API as before (Button, Card, Input, Select, Field,
// Badge, Table/Td/Tr, Modal, Tile, IconButton, useConfirm, rupee, cn) so pages keep working.
// Icons are MUI icons (from @/components/icons) passed as `Icon` props; they accept a `size` prop.
import { useEffect, useState, useRef } from "react";
import MuiButton from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import MuiTable from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import MuiTableRow from "@mui/material/TableRow";
import MuiTableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";

export function cn(...a) { return a.filter(Boolean).join(" "); }
export function rupee(n) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); }

// Count-up animated number.
export function AnimatedNumber({ value = 0, format = (n) => Math.round(n), duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    let raf; const start = performance.now(); const from = ref.current; const to = Number(value) || 0;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick); else ref.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(display)}</>;
}

const FORMATS = {
  int: (n) => Math.round(n).toLocaleString("en-IN"),
  rupee: (n) => "₹" + Math.round(n).toLocaleString("en-IN"),
  litre: (n) => `${Math.round(n)} L`,
};

export function Button({ variant = "primary", size = "md", className, sx, Icon, children, ...props }) {
  const map = {
    primary: { variant: "contained", color: "primary" },
    blue: { variant: "contained", color: "info" },
    danger: { variant: "contained", color: "error" },
    secondary: { variant: "outlined", color: "inherit", soft: true },
    ghost: { variant: "text", color: "inherit" },
  };
  const m = map[variant] || map.primary;
  const sizeMap = { sm: "small", md: "medium", lg: "large" };
  const base = m.soft
    ? { bgcolor: "rgba(255,255,255,0.75)", borderColor: "divider", color: "text.primary", "&:hover": { bgcolor: "rgba(255,255,255,0.95)" } }
    : {};
  return (
    <MuiButton variant={m.variant} color={m.color} size={sizeMap[size] || "medium"} disableElevation
      startIcon={Icon ? <Icon size={18} /> : undefined} className={className} sx={[base, ...(Array.isArray(sx) ? sx : [sx])]} {...props}>
      {children}
    </MuiButton>
  );
}

export function IconButton({ Icon, label, tone = "slate", title, className, sx, ...props }) {
  const colorMap = { slate: "inherit", indigo: "primary", rose: "error", emerald: "success" };
  return (
    <MuiButton size="small" variant="text" color={colorMap[tone] || "inherit"} title={title || label}
      startIcon={Icon ? <Icon size={15} /> : undefined} className={className}
      sx={[{ minWidth: 0, px: 1, py: 0.5, borderRadius: 2, fontSize: 12 }, ...(Array.isArray(sx) ? sx : [sx])]} {...props}>
      {label}
    </MuiButton>
  );
}

export function Card({ className, glass = true, sx, children, ...props }) {
  return (
    <Paper elevation={0} className={className} sx={[{ p: 2.5, borderRadius: 4, boxShadow: "0 12px 32px -14px rgba(15,23,42,0.18)" }, ...(Array.isArray(sx) ? sx : [sx])]} {...props}>
      {children}
    </Paper>
  );
}

// Centered loading state — shown on first data load so a slow server (Vercel cold start /
// Atlas latency) never looks like an empty page.
export function PageLoader({ label = "Loading…" }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 12, gap: 2 }}>
      <CircularProgress size={34} thickness={4} />
      <Typography sx={{ fontSize: 14, color: "text.secondary" }}>{label}</Typography>
    </Box>
  );
}

export function Input({ className, sx, ...props }) {
  return <TextField size="small" fullWidth className={className} sx={sx} {...props} />;
}

export function Select({ className, children, sx, ...props }) {
  return (
    <TextField select size="small" fullWidth slotProps={{ select: { native: true } }} className={className} sx={sx} {...props}>
      {children}
    </TextField>
  );
}

export function Field({ label, children, className, sx }) {
  return (
    <Box className={className} sx={sx}>
      {label && <Typography variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600, color: "text.secondary" }}>{label}</Typography>}
      {children}
    </Box>
  );
}

export function Badge({ tone = "gray", children, sx }) {
  const softMap = {
    gray: { bgcolor: "rgba(100,116,139,0.14)", color: "#475569" },
    green: { bgcolor: "rgba(16,185,129,0.16)", color: "#047857" },
    red: { bgcolor: "rgba(244,63,94,0.16)", color: "#be123c" },
    yellow: { bgcolor: "rgba(245,158,11,0.18)", color: "#b45309" },
    blue: { bgcolor: "rgba(37,99,235,0.16)", color: "#1d4ed8" },
    indigo: { bgcolor: "rgba(79,70,229,0.16)", color: "#4338ca" },
  };
  return <Chip size="small" label={children} sx={[{ fontWeight: 600, height: 22, ...(softMap[tone] || softMap.gray) }, ...(Array.isArray(sx) ? sx : [sx])]} />;
}

export function Table({ head = [], children, sx }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={[{ borderRadius: 4, boxShadow: "0 12px 32px -14px rgba(15,23,42,0.18)" }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <MuiTable size="small">
        <TableHead>
          <MuiTableRow>
            {head.map((h, i) => (
              <MuiTableCell key={i} sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 }}>{h}</MuiTableCell>
            ))}
          </MuiTableRow>
        </TableHead>
        <TableBody>{children}</TableBody>
      </MuiTable>
    </TableContainer>
  );
}
export function Td({ className, sx, children, ...p }) { return <MuiTableCell className={className} sx={sx} {...p}>{children}</MuiTableCell>; }
export function Tr({ className, sx, children, ...p }) { return <MuiTableRow hover className={className} sx={sx} {...p}>{children}</MuiTableRow>; }

export function Modal({ title, onClose, children, wide }) {
  return (
    <Dialog open onClose={onClose} maxWidth={wide ? "md" : "sm"} fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      {title && <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{title}</DialogTitle>}
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}

// Promise-based confirmation dialog. `const { confirm, ConfirmModal } = useConfirm()`.
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const close = (v) => { state?.resolve(v); setState(null); };
  const ConfirmModal = state ? (
    <Modal title={state.title || "Are you sure?"} onClose={() => close(false)}>
      <Typography sx={{ color: "text.secondary", lineHeight: 1.6 }}>{state.message}</Typography>
      <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="secondary" onClick={() => close(false)}>{state.cancelLabel || "Cancel"}</Button>
        <Button variant={state.danger ? "danger" : "primary"} onClick={() => close(true)}>{state.confirmLabel || "Confirm"}</Button>
      </Box>
    </Modal>
  ) : null;
  return { confirm, ConfirmModal };
}

// Minimal, professional stat tile: dotted texture + visible tone gradient. number → count-up.
// Hero stat: colored gradient card + circular progress ring + big number. For the
// "first-eye" daily metrics on the dashboard (settlement, collection, pending invoices).
export function RingStat({ label, value, percent = 0, sub, tone = "blue", delay = 0 }) {
  const grads = {
    green: "linear-gradient(135deg,#0d9488 0%,#047857 100%)",
    blue: "linear-gradient(135deg,#2563eb 0%,#1e3a8a 100%)",
    amber: "linear-gradient(135deg,#f59e0b 0%,#b45309 100%)",
    rose: "linear-gradient(135deg,#fb7185 0%,#be123c 100%)",
    indigo: "linear-gradient(135deg,#6366f1 0%,#4338ca 100%)",
  };
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const Rr = 26, CIRC = 2 * Math.PI * Rr;
  return (
    <Paper elevation={0} className="animate-rise" style={{ animationDelay: `${delay}ms` }}
      sx={{ position: "relative", overflow: "hidden", borderRadius: 4, p: 2, color: "#fff", backgroundImage: grads[tone] || grads.blue, boxShadow: "0 14px 32px -18px rgba(15,23,42,0.55)", display: "flex", alignItems: "center", gap: 2 }}>
      <Box sx={{ position: "absolute", right: -28, top: -28, width: 110, height: 110, borderRadius: "50%", border: "18px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
      <Box sx={{ position: "absolute", right: 10, bottom: -28, width: 64, height: 64, borderRadius: "50%", border: "12px solid rgba(255,255,255,0.07)", pointerEvents: "none" }} />
      <Box component="svg" width="62" height="62" viewBox="0 0 64 64" sx={{ flexShrink: 0, display: "block" }}>
        <circle cx="32" cy="32" r={Rr} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="6" />
        <circle cx="32" cy="32" r={Rr} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)} transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset .6s ease" }} />
        <text x="32" y="36" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{pct}%</text>
      </Box>
      <Box sx={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{value}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 600, opacity: 0.95 }}>{label}</Typography>
        {sub ? <Typography sx={{ fontSize: 11, opacity: 0.82, mt: 0.25 }}>{sub}</Typography> : null}
      </Box>
    </Paper>
  );
}

export function Tile({ label, value, tone = "indigo", Icon, format = "int", delay = 0 }) {
  const tones = {
    indigo: { from: "#818cf8", to: "#4f46e5", dot: "rgba(79,70,229,0.14)", glow: "rgba(99,102,241,0.40)" },
    green: { from: "#34d399", to: "#059669", dot: "rgba(16,185,129,0.14)", glow: "rgba(16,185,129,0.40)" },
    blue: { from: "#60a5fa", to: "#2563eb", dot: "rgba(37,99,235,0.14)", glow: "rgba(59,130,246,0.40)" },
    amber: { from: "#fbbf24", to: "#d97706", dot: "rgba(245,158,11,0.16)", glow: "rgba(245,158,11,0.42)" },
    teal: { from: "#2dd4bf", to: "#0d9488", dot: "rgba(20,184,166,0.14)", glow: "rgba(20,184,166,0.40)" },
    rose: { from: "#fb7185", to: "#e11d48", dot: "rgba(244,63,94,0.14)", glow: "rgba(244,63,94,0.40)" },
  };
  const c = tones[tone] || tones.indigo;
  const fmt = typeof format === "function" ? format : (FORMATS[format] || FORMATS.int);
  const isNum = typeof value === "number";
  return (
    <Paper elevation={0} className="animate-rise" style={{ animationDelay: `${delay}ms` }}
      sx={{ position: "relative", overflow: "hidden", borderRadius: 3, p: 1.25, boxShadow: "0 8px 22px -16px rgba(15,23,42,0.20)" }}>
      <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.85, backgroundImage: `radial-gradient(${c.dot} 1px, transparent 1.6px)`, backgroundSize: "14px 14px" }} />
      <Box sx={{ position: "absolute", top: -30, right: -24, width: 72, height: 72, borderRadius: "50%", filter: "blur(22px)", pointerEvents: "none", background: `radial-gradient(circle, ${c.glow}, transparent 68%)` }} />
      <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.75 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "text.secondary", lineHeight: 1.2 }}>{label}</Typography>
        {Icon ? (
          <Box sx={{ width: 26, height: 26, flexShrink: 0, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", backgroundImage: `linear-gradient(135deg, ${c.from}, ${c.to})`, boxShadow: `0 5px 12px -6px ${c.glow}` }}>
            <Icon size={15} />
          </Box>
        ) : null}
      </Box>
      <Typography sx={{ position: "relative", mt: 0.4, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color: "text.primary" }}>
        {isNum ? <AnimatedNumber value={value} format={fmt} /> : value}
      </Typography>
    </Paper>
  );
}
