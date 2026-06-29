"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  LayoutDashboard, Building2, Truck, Users, UserCog, Package, AlertTriangle,
  Wrench, Wallet, LogOut, Calculator, ChevronDown, ChevronRight, Settings, Scale, BarChart3, History,
  ChevronsLeft, ChevronsRight, Sparkles, Gauge, Toll,
} from "@/components/icons";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import { AppContext } from "@/lib/appContext";
import { api, getActiveTransport, setActiveTransport, getActiveCompany, setActiveCompany, companyLabel } from "@/lib/clientApi";
import UploadFab from "@/components/UploadFab";
import NotificationBell from "@/components/NotificationBell";

// Day-to-day operations — shown at the top, always expanded.
const OPS_NAV = [
  { href: "/app", label: "Overview", Icon: LayoutDashboard },
  { href: "/app/loads", label: "Loads", Icon: Package },
  { href: "/app/ledger", label: "Statement Of Freight", Icon: Scale },
  { href: "/app/shortages", label: "Shortage Cuts", Icon: AlertTriangle },
  { href: "/app/meter-readings", label: "Meter Readings", Icon: Gauge },
  { href: "/app/maintenance", label: "Maintenance", Icon: Wrench },
  { href: "/app/fastag", label: "FASTag / Tolls", Icon: Toll },
  { href: "/app/salaries", label: "Salaries", Icon: Wallet, ownerOnly: true },
  { href: "/app/reports", label: "Reports", Icon: BarChart3 },
];
// Admin (phone+PIN admin) — master-data approvals.
const ADMIN_NAV = [
  { href: "/app/approvals", label: "RTKM Approvals", Icon: Gauge },
];
// Configuration & tools — grouped under a single collapsible "Settings" menu.
const SETUP_NAV = [
  { href: "/app/transports", label: "Transports", Icon: Building2, ownerOnly: true },
  { href: "/app/trucks", label: "Trucks / Tankers", Icon: Truck },
  { href: "/app/drivers", label: "Drivers", Icon: Users },
  { href: "/app/managers", label: "Managers", Icon: UserCog, ownerOnly: true },
  { href: "/app/uploads", label: "Uploads (Undo)", Icon: History },
  { href: "/app/settings", label: "App settings", Icon: Settings },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState(undefined);
  const [transports, setTransports] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompanyState] = useState("all");
  const [collapsed, setCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState(null);

  useEffect(() => { try { setCollapsed(localStorage.getItem("rtkm_sidebar") === "1"); } catch {} }, []);
  const toggleSidebar = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem("rtkm_sidebar", n ? "1" : "0"); } catch {} return n; });
  // Optimistic nav: highlight the clicked item + show a loading bar immediately, before the route commits.
  useEffect(() => { setPendingHref(null); }, [pathname]);
  const handleNav = (href) => { if (href !== pathname) setPendingHref(href); };

  const reloadTransports = useCallback(async () => {
    const { transports } = await api("/api/transports");
    setTransports(transports);
    return transports;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const m = await api("/api/auth/owner/me");
        setMe(m);
        if (m.role === "owner" || m.role === "manager") {
          const trs = await reloadTransports();
          const saved = getActiveTransport();
          const pick = m.role === "manager" ? m.transportId : (trs.find((t) => t.id === saved)?.id || trs[0]?.id || null);
          if (pick) { setActiveId(pick); setActiveTransport(pick); }
        }
      } catch { setMe(null); }
    })();
  }, [reloadTransports]);

  useEffect(() => { if (me === null) router.replace("/login"); }, [me, router]);

  // Restore the selected company/depot, and load which companies this transport has data for.
  useEffect(() => { setActiveCompanyState(getActiveCompany()); }, []);
  useEffect(() => {
    if (!activeId || (me?.role !== "owner" && me?.role !== "manager")) { setCompanies([]); return; }
    api(`/api/companies?transportId=${activeId}`).then((d) => {
      const list = d.companies || [];
      setCompanies(list);
      // If the saved company isn't used by this transport, fall back to "all".
      setActiveCompanyState((cur) => (cur !== "all" && !list.includes(cur) ? "all" : cur));
    }).catch(() => setCompanies([]));
  }, [activeId, me]);
  function switchCompany(c) { setActiveCompanyState(c); setActiveCompany(c); }

  if (me === undefined) return <Center>Loading…</Center>;
  if (me === null) return <Center>Redirecting…</Center>;

  async function logout() {
    await api("/api/auth/owner/logout", { method: "POST" });
    try { localStorage.removeItem("rtkm-swr-cache"); } catch {} // don't leak cached data to the next user
    router.replace("/login");
  }
  function switchTransport(id) { setActiveId(id); setActiveTransport(id); }

  const isDriver = me.role === "driver";
  const isAdmin = me.role === "admin";
  const canSee = (n) => !(n.ownerOnly && me.role !== "owner");
  const opsNav = isAdmin ? ADMIN_NAV : OPS_NAV.filter(canSee);
  const setupNav = isAdmin ? [] : SETUP_NAV.filter(canSee);
  const flatNav = [...opsNav, ...setupNav];
  const pageTitle = flatNav.find((n) => n.href === pathname)?.label || (isAdmin ? "Admin" : isDriver ? "My dashboard" : "Overview");
  const initials = (me.name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <AppContext.Provider value={{ me, transports, activeId, switchTransport, reloadTransports, companies, activeCompany, switchCompany }}>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        {!isDriver && (
          <Box component="aside" className="glass"
            sx={{ position: "sticky", top: 0, display: { xs: "none", md: "flex" }, height: "100vh", width: collapsed ? 76 : 256, flexDirection: "column", borderRight: "1px solid", borderColor: "rgba(255,255,255,0.6)", p: 1.5, transition: "width .2s ease" }}>
            <Box sx={{ display: "flex", flexDirection: collapsed ? "column" : "row", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 1 }}>
              <Brand collapsed={collapsed} />
              <IconButton onClick={toggleSidebar} size="small" title={collapsed ? "Expand menu" : "Collapse menu"}
                sx={{ color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,0.7)" } }}>
                {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
              </IconButton>
            </Box>
            <Box component="nav" sx={{ mt: 2.5, flex: 1, display: "flex", flexDirection: "column", gap: 0.5, overflowY: "auto" }}>
              {opsNav.map((n) => <NavLink key={n.href} {...n} selected={(pendingHref || pathname) === n.href} collapsed={collapsed} onNav={handleNav} />)}
              {setupNav.length > 0 && (
                collapsed
                  ? <>
                      <Box sx={{ my: 0.5, mx: "auto", width: 24, borderTop: "1px solid", borderColor: "rgba(148,163,184,0.25)" }} />
                      {setupNav.map((n) => <NavLink key={n.href} {...n} selected={(pendingHref || pathname) === n.href} collapsed onNav={handleNav} />)}
                    </>
                  : <SetupGroup items={setupNav} currentHref={pendingHref || pathname} onNav={handleNav} />
              )}
            </Box>
            <NavLink href="/" label="Calculator" Icon={Calculator} selected={false} collapsed={collapsed} onNav={handleNav} />
          </Box>
        )}

        <Box sx={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
          <Box component="header" className="glass"
            sx={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, borderBottom: "1px solid", borderColor: "rgba(255,255,255,0.6)", px: 2, py: 1.5, "@media (min-width:900px)": { px: 3 } }}>
            <Box sx={{ display: "flex", minWidth: 0, alignItems: "center", gap: 0.75, fontSize: 14 }}>
              <Typography component="span" sx={{ color: "text.disabled" }}>{isDriver ? "Driver" : "Dashboard"}</Typography>
              <Box component={ChevronRight} size={16} sx={{ flexShrink: 0, color: "rgba(148,163,184,0.7)" }} />
              <Typography component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: { xs: 16, md: 18 }, fontWeight: 700, color: "text.primary" }}>{pageTitle}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, md: 1.5 } }}>
              {!isDriver && companies.length >= 2 && (
                <Box sx={{ position: "relative" }} title="Filter by oil company / depot">
                  <Box component="select" value={activeCompany} onChange={(e) => switchCompany(e.target.value)}
                    sx={{
                      appearance: "none", borderRadius: 3, border: "1px solid",
                      borderColor: activeCompany === "all" ? "divider" : "primary.light",
                      bgcolor: activeCompany === "all" ? "rgba(255,255,255,0.7)" : "rgba(79,70,229,0.08)",
                      py: 1, pl: 1.5, pr: 4, fontSize: 14, fontWeight: 600, color: activeCompany === "all" ? "text.secondary" : "primary.dark", outline: "none",
                      "&:focus": { borderColor: "primary.light" },
                    }}>
                    <option value="all">All companies</option>
                    {companies.map((c) => <option key={c} value={c}>{companyLabel(c)}</option>)}
                  </Box>
                  <Box component={ChevronDown} size={16} sx={{ pointerEvents: "none", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "text.disabled" }} />
                </Box>
              )}
              {me.role === "owner" && transports.length > 0 && (
                <Box sx={{ position: "relative", display: { xs: "none", sm: "block" } }}>
                  <Box component="select" value={activeId || ""} onChange={(e) => switchTransport(e.target.value)}
                    sx={{
                      appearance: "none", borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "rgba(255,255,255,0.7)",
                      py: 1, pl: 1.5, pr: 4, fontSize: 14, fontWeight: 500, color: "text.primary", outline: "none",
                      "&:focus": { borderColor: "primary.light" },
                    }}>
                    {transports.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Box>
                  <Box component={ChevronDown} size={16} sx={{ pointerEvents: "none", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "text.disabled" }} />
                </Box>
              )}
              {!isDriver && <NotificationBell />}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, borderRadius: 3, bgcolor: "rgba(255,255,255,0.6)", py: 0.75, pl: 0.75, pr: 1.5 }}>
                <Box component="span" sx={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 2, backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)", fontSize: 12, fontWeight: 700, color: "#fff" }}>{initials}</Box>
                <Box sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.2 }}>
                  <Box sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 600, color: "text.primary" }}>{me.name}</Box>
                  <Box sx={{ fontSize: 11, textTransform: "capitalize", color: "text.disabled" }}>{me.role}</Box>
                </Box>
              </Box>
              <IconButton onClick={logout} title="Sign out"
                sx={{ borderRadius: 3, bgcolor: "rgba(255,255,255,0.6)", p: 1, color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,0.9)", color: "error.main" } }}>
                <LogOut size={18} />
              </IconButton>
            </Box>
          </Box>

          {!isDriver && (
            <Box className="glass"
              sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1, overflow: "auto", borderBottom: "1px solid", borderColor: "rgba(255,255,255,0.6)", px: 1.5, py: 1 }}>
              {flatNav.map((n) => {
                const active = (pendingHref || pathname) === n.href;
                return (
                  <Box component={Link} key={n.href} href={n.href} onClick={() => handleNav(n.href)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.75, whiteSpace: "nowrap", borderRadius: 2, px: 1.5, py: 0.75, fontSize: 14, fontWeight: 500,
                      ...(active ? { bgcolor: "primary.main", color: "#fff" } : { bgcolor: "rgba(255,255,255,0.7)", color: "text.secondary" }),
                    }}>
                    <n.Icon size={16} /> {n.label}
                  </Box>
                );
              })}
            </Box>
          )}

          <Box sx={{ position: "relative", height: 3 }}>
            {pendingHref && <LinearProgress sx={{ position: "absolute", inset: 0, height: 3 }} />}
          </Box>
          <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>{children}</Box>
        </Box>
      </Box>
      <UploadFab />
    </AppContext.Provider>
  );
}

// Sidebar nav item — icon+label when expanded, icon-only with a tooltip when collapsed.
// `selected` is optimistic (set on click) so the highlight moves instantly, before the route commits.
function NavLink({ href, label, Icon, selected, collapsed, onNav }) {
  const el = (
    <Box component={Link} href={href} onClick={() => onNav?.(href)}
      sx={{
        display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 1.5,
        borderRadius: 2.5, px: collapsed ? 0 : 1.5, py: 1.1, minHeight: 42, fontSize: 14, fontWeight: 500, transition: "background-color .15s, color .15s",
        ...(selected
          ? { backgroundImage: "linear-gradient(90deg,#7c3aed,#4f46e5)", color: "#fff", boxShadow: "0 6px 18px -6px rgba(79,70,229,0.45)" }
          : { color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,0.7)", color: "text.primary" } }),
      }}>
      <Box component={Icon} size={19} sx={{ flexShrink: 0 }} />
      {!collapsed && <Box component="span" sx={{ whiteSpace: "nowrap" }}>{label}</Box>}
    </Box>
  );
  return collapsed ? <Tooltip title={label} placement="right" arrow>{el}</Tooltip> : el;
}

// "Setup" — a single collapsible parent menu holding the one-time-setup pages.
// Auto-opens when you're on one of its pages, and remembers your manual toggle.
function SetupGroup({ items, currentHref, onNav }) {
  const hasActive = items.some((n) => n.href === currentHref);
  const [open, setOpen] = useState(hasActive);
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  return (
    <Box sx={{ mt: 0.5 }}>
      <Box component="button" onClick={() => setOpen((o) => !o)}
        sx={{
          width: "100%", cursor: "pointer", border: 0, bgcolor: "transparent", textAlign: "left",
          display: "flex", alignItems: "center", gap: 1.5, borderRadius: 2.5, px: 1.5, py: 1.1, minHeight: 42, fontSize: 14, fontWeight: 500,
          color: hasActive && !open ? "primary.main" : "text.secondary", transition: "background-color .15s, color .15s",
          "&:hover": { bgcolor: "rgba(255,255,255,0.7)", color: "text.primary" },
        }}>
        <Box component={Settings} size={19} sx={{ flexShrink: 0 }} />
        <Box component="span" sx={{ flex: 1, whiteSpace: "nowrap" }}>Settings</Box>
        <Box component={open ? ChevronDown : ChevronRight} size={16} sx={{ flexShrink: 0, color: "text.disabled" }} />
      </Box>
      {open && (
        <Box sx={{ ml: 1.75, pl: 1.25, borderLeft: "1px solid", borderColor: "rgba(148,163,184,0.25)", display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
          {items.map((n) => <NavLink key={n.href} {...n} selected={currentHref === n.href} collapsed={false} onNav={onNav} />)}
        </Box>
      )}
    </Box>
  );
}

function Brand({ collapsed }) {
  return (
    <Box component={Link} href="/app" sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box component="span" sx={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 2.5, backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 6px 18px -6px rgba(79,70,229,0.45)" }}>
        <Box component={Truck} size={20} sx={{ color: "#fff" }} />
      </Box>
      {!collapsed && (
        <Box sx={{ lineHeight: 1.2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 16, fontWeight: 800, backgroundImage: "linear-gradient(90deg,#7c3aed,#4f46e5)", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
            RTKM <Box component={Sparkles} size={13} sx={{ color: "#7c3aed", opacity: 0.8 }} />
          </Box>
          <Box sx={{ fontSize: 11, color: "text.disabled" }}>Transport Suite</Box>
        </Box>
      )}
    </Box>
  );
}

function Center({ children }) {
  return <Box sx={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>{children}</Box>;
}
