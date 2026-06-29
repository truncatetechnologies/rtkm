// Design tokens — premium indigo/violet palette + glassmorphism.
// (Key names kept stable so screens don't need renaming; values are the new look.)
export const C = {
  // primary accent (indigo) — was green
  green: "#4F46E5",
  greenDark: "#4338CA",
  greenLight: "#EEF2FF",
  gradFrom: "#7C3AED", // violet
  gradTo: "#4F46E5",   // indigo

  blue: "#2563EB",
  blueLight: "#E0ECFF",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  red: "#E11D48",
  redLight: "#FFE4E6",
  teal: "#0EA5A4",

  // neutrals (iOS grouped-background tone)
  bg: "#F2F2F7",
  card: "#FFFFFF",
  ink: "#1C1C2E",
  sub: "#6B7280",
  faint: "#A1A1AA",
  line: "#E5E5EA",
  white: "#FFFFFF",

  // matte background: near-neutral gradient + very faint tint blobs
  bgGrad: ["#F5F5F9", "#F1F1F6", "#F2F2F7"],
  blobA: "#DDE2F2", // faint indigo
  blobB: "#E6E1F2", // faint violet
  blobC: "#DEEAF5", // faint sky

  // frosted glass surfaces — iOS-material style (matte, mostly opaque)
  glass: "rgba(255,255,255,0.72)",
  glassStrong: "rgba(255,255,255,0.85)",
  glassBorder: "rgba(255,255,255,0.85)",
  glassOnDark: "rgba(255,255,255,0.18)",
};

export const R = { sm: 10, md: 14, lg: 22, xl: 30, pill: 999 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 };

export const shadow = {
  shadowColor: "#312E81",
  shadowOpacity: 0.14,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
};
export const shadowSoft = {
  shadowColor: "#312E81",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};
