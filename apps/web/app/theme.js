"use client";
import { createTheme } from "@mui/material/styles";

// MUI theme matching the app's indigo/violet, frosted-glass aesthetic.
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#4f46e5", dark: "#4338ca", light: "#818cf8" },
    secondary: { main: "#7c3aed" },
    success: { main: "#059669", light: "#34d399" },
    error: { main: "#e11d48" },
    warning: { main: "#d97706" },
    info: { main: "#2563eb" },
    background: { default: "#f2f2f7", paper: "rgba(255,255,255,0.86)" },
    text: { primary: "#1c1c2e", secondary: "#64748b" },
    divider: "rgba(15,23,42,0.08)",
  },
  // NOTE: sx `borderRadius: N` multiplies this base. Keep it at 4 (MUI default) so the
  // conversion's borderRadius:2/3/4 land at 8/12/16px (rounded-lg/xl/2xl), not giant pills.
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
    h4: { fontWeight: 800, letterSpacing: "-0.02em" },
    h5: { fontWeight: 800, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: "none" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f2f2f7",
          backgroundImage:
            "radial-gradient(45rem 45rem at 110% -10%, rgba(124,58,237,0.12), transparent 60%)," +
            "radial-gradient(40rem 40rem at -10% 5%, rgba(37,99,235,0.10), transparent 55%)," +
            "radial-gradient(38rem 38rem at 50% 120%, rgba(14,165,164,0.08), transparent 60%)",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
          minHeight: "100vh",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none", border: "1px solid rgba(255,255,255,0.85)", backdropFilter: "blur(20px) saturate(140%)" },
        rounded: { borderRadius: 16 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, background: "rgba(255,255,255,0.7)" } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: "rgba(15,23,42,0.06)" } } },
  },
});

export default theme;
