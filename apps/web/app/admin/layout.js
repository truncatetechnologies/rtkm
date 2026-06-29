"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Fuel, CheckSquare, Users, LogOut, Calculator, Truck } from "@/components/icons";
import { Box, Typography } from "@mui/material";
import { useAdminGate } from "@/lib/useAdminGate";

const NAV = [
  { href: "/admin", label: "Pumps", Icon: Fuel },
  { href: "/admin/approvals", label: "Approvals", Icon: CheckSquare },
  { href: "/admin/transporters", label: "Transporters", Icon: Truck },
  { href: "/admin/owners", label: "Owners", Icon: Users },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const { isAdmin, label, signOut } = useAdminGate();

  if (pathname === "/admin/signin") return children;

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Box component="header" className="glass" sx={{ position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid", borderColor: "rgba(255,255,255,0.6)" }}>
        <Box sx={{ mx: "auto", display: "flex", maxWidth: 1152, alignItems: "center", gap: 1.5, px: 2, py: 1.5 }}>
          <Typography component="span" sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800, color: "text.primary" }}>
            <Box component="span" sx={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 2, backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}><ShieldCheck size={16} color="#fff" /></Box>
            Admin
          </Typography>
          {isAdmin && (
            <Box component="nav" sx={{ ml: 1, display: "flex", gap: 0.5, fontSize: 14 }}>
              {NAV.map((n) => (
                <Box key={n.href} component={Link} href={n.href}
                  sx={[
                    { display: "flex", alignItems: "center", gap: 0.75, borderRadius: 2, px: 1.5, py: 0.75, fontWeight: 500, transition: "all .2s", textDecoration: "none" },
                    pathname === n.href
                      ? { bgcolor: "primary.main", color: "#fff" }
                      : { color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,0.7)" } },
                  ]}>
                  <n.Icon size={16} /> {n.label}
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, fontSize: 14 }}>
            <Box component={Link} href="/" sx={{ display: "flex", alignItems: "center", gap: 0.75, borderRadius: 2, px: 1.5, py: 0.75, color: "text.secondary", textDecoration: "none", "&:hover": { bgcolor: "rgba(255,255,255,0.7)" } }}><Calculator size={16} /> <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Calculator</Box></Box>
            {isAdmin && <>
              <Typography component="span" sx={{ display: { xs: "none", md: "inline" }, color: "text.disabled" }}>{label}</Typography>
              <Box component="button" onClick={signOut} title="Sign out"
                sx={{ border: "1px solid", borderColor: "rgba(225,29,72,0.25)", cursor: "pointer", borderRadius: 2, bgcolor: "rgba(225,29,72,0.06)", px: 1.5, py: 0.75, color: "error.main", fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 0.75, "&:hover": { bgcolor: "rgba(225,29,72,0.12)" } }}>
                <LogOut size={16} /> <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Sign out</Box>
              </Box>
            </>}
          </Box>
        </Box>
      </Box>
      <Box component="main" sx={{ mx: "auto", maxWidth: 1152, px: 2, py: 3 }}>{children}</Box>
    </Box>
  );
}
