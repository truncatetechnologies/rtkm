import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, S, shadow, shadowSoft } from "../lib/theme";

// Aurora gradient background with soft color blobs — gives glass something to frost.
export function ScreenBg({ children, style }) {
  return (
    <View style={[{ flex: 1, backgroundColor: C.bg }, style]}>
      <LinearGradient colors={C.bgGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: C.blobA, top: -70, left: -50 }]} />
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: C.blobB, top: 90, right: -70, width: 200, height: 200 }]} />
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: C.blobC, bottom: -40, left: -30, width: 180, height: 180 }]} />
      {children}
    </View>
  );
}

// Frosted glass card.
export function Card({ children, style, strong }) {
  return (
    <View style={[styles.cardShadow, style]}>
      <BlurView intensity={32} tint="light" style={styles.cardBlur}>
        <View style={[styles.cardInner, { backgroundColor: strong ? C.glassStrong : C.glass }]}>{children}</View>
      </BlurView>
    </View>
  );
}

export function AppButton({ title, onPress, icon, variant = "primary", disabled, loading, style }) {
  const map = {
    primary: { bg: C.green, fg: "#fff" },
    blue: { bg: C.blue, fg: "#fff" },
    danger: { bg: C.red, fg: "#fff" },
    light: { bg: "rgba(255,255,255,0.85)", fg: C.ink, border: C.glassBorder },
  };
  const v = map[variant] || map.primary;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={disabled || loading}
      style={[styles.btn, { backgroundColor: v.bg, borderWidth: v.border ? 1 : 0, borderColor: v.border }, (disabled || loading) && { opacity: 0.55 }, variant !== "light" && shadowSoft, style]}>
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <View style={styles.btnRow}>
          {icon ? <MaterialCommunityIcons name={icon} size={20} color={v.fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.btnText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={active ? "#fff" : C.green} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StepLabel({ n, icon, children }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{n}</Text></View>
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={C.green} style={{ marginRight: 6 }} /> : null}
      <Text style={styles.stepText}>{children}</Text>
    </View>
  );
}

export function SectionTitle({ children, icon, right }) {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {icon ? <MaterialCommunityIcons name={icon} size={18} color={C.ink} style={{ marginRight: 6 }} /> : null}
        <Text style={styles.sectionTitle}>{children}</Text>
      </View>
      {right}
    </View>
  );
}

// Clean, solid stat tile. Fills and clips its slot (flex:1 + overflow:hidden) so it can never
// spill over a neighbour inside a fixed-height bento row. A faint tone-tinted top band + a solid
// colour icon chip give it life without the fragile blur/gradient stacking that used to overlap.
export function Tile({ label, value, icon, tone = "indigo", big = false, sub, style }) {
  const tones = {
    indigo: "#4F46E5", green: "#059669", blue: "#2563EB",
    amber: "#D97706", teal: "#0D9488", rose: "#E11D48",
  };
  const clr = tones[tone] || tones.indigo;
  return (
    <View style={[styles.tileCard, big && styles.tileCardBig, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: clr, opacity: 0.05 }]} />
      <View style={styles.tileTop}>
        <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
        {icon ? (
          <View style={[styles.tileIcon, { width: big ? 40 : 30, height: big ? 40 : 30, borderRadius: big ? 13 : 10, backgroundColor: clr + "1F" }]}>
            <MaterialCommunityIcons name={icon} size={big ? 22 : 17} color={clr} />
          </View>
        ) : null}
      </View>
      <View>
        <Text style={[styles.tileVal, big && { fontSize: 28 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{value}</Text>
        {sub ? <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function EmptyState({ icon = "inbox-outline", text }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={42} color={C.faint} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// Gradient header with a glass right-slot.
// Light bento-style header: soft white panel, dark text, accent icon chip.
export function GradientHeader({ title, subtitle, icon, right, onBack, onMenu }) {
  return (
    <View style={styles.gh}>
      <View style={styles.ghRow}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.ghIcon}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#4F46E5" />
            </TouchableOpacity>
          ) : onMenu ? (
            <TouchableOpacity onPress={onMenu} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.ghIcon}>
              <MaterialCommunityIcons name="menu" size={24} color="#4F46E5" />
            </TouchableOpacity>
          ) : icon ? <View style={styles.ghIcon}><MaterialCommunityIcons name={icon} size={22} color="#4F46E5" /></View> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.ghTitle} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.ghSub} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        {right ? <View style={{ flexShrink: 0, marginLeft: 8 }}>{right}</View> : null}
      </View>
    </View>
  );
}

// Glass dropdown -> bottom-sheet list.
export function Dropdown({ value, placeholder, icon, options, onChange, title }) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.value === value);
  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(true)} style={styles.selectShadow}>
        <BlurView intensity={26} tint="light" style={styles.selectBlur}>
          <View style={styles.selectInner}>
            {icon ? <MaterialCommunityIcons name={icon} size={20} color={C.green} style={{ marginRight: 8 }} /> : null}
            <Text style={[styles.selectText, !sel && { color: C.faint }]} numberOfLines={1}>{sel ? sel.label : placeholder}</Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color={C.faint} />
          </View>
        </BlurView>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.ddBg} onPress={() => setOpen(false)}>
          <View style={styles.ddSheet}>
            <View style={styles.handle} />
            {title ? <Text style={styles.ddTitle}>{title}</Text> : null}
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <TouchableOpacity key={o.value} style={styles.ddRow} onPress={() => { onChange(o.value); setOpen(false); }}>
                    <Text style={[styles.ddRowText, active && { color: C.green, fontWeight: "800" }]}>{o.label}</Text>
                    {active ? <MaterialCommunityIcons name="check-circle" size={20} color={C.green} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export { MaterialCommunityIcons, LinearGradient, BlurView };

const styles = StyleSheet.create({
  blob: { position: "absolute", width: 230, height: 230, borderRadius: 140, opacity: 0.35 },
  cardShadow: { borderRadius: R.lg, ...shadow },
  cardBlur: { borderRadius: R.lg, overflow: "hidden", borderWidth: 1, borderColor: C.glassBorder },
  cardInner: { padding: S.lg },
  btn: { borderRadius: R.md, paddingVertical: 15, paddingHorizontal: S.lg, alignItems: "center", justifyContent: "center" },
  btnRow: { flexDirection: "row", alignItems: "center" },
  btnText: { fontSize: 16, fontWeight: "700" },
  chip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.glassBorder, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 10 },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.sub, fontSize: 15, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center", marginRight: 8 },
  stepBadgeText: { color: C.green, fontWeight: "800", fontSize: 13 },
  stepText: { fontSize: 16, fontWeight: "700", color: C.ink },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: S.xl, marginBottom: S.md },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: C.ink },
  // alignSelf:flex-start stops the Yoga stretch quirk (flexBasis-0 items in a flexWrap row inside a
  // ScrollView blow up to the full content height); flexBasis:44% gives a stable 2-per-row grid.
  tileCard: { flexGrow: 1, flexShrink: 1, flexBasis: "44%", minWidth: "44%", minHeight: 88, alignSelf: "flex-start", borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(15,23,42,0.06)", padding: 13, justifyContent: "space-between", overflow: "hidden", ...shadowSoft },
  tileCardBig: { minHeight: 116, padding: 16 },
  tileTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tileIcon: { alignItems: "center", justifyContent: "center" },
  tileVal: { fontSize: 22, fontWeight: "800", marginTop: 8, color: C.ink, letterSpacing: -0.5 },
  tileLabel: { flex: 1, fontSize: 10.5, fontWeight: "700", color: C.faint, textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 14, marginTop: 3, marginRight: 8 },
  tileSub: { fontSize: 11, color: C.sub, marginTop: 2, fontWeight: "600" },
  empty: { alignItems: "center", justifyContent: "center", padding: S.xxl },
  emptyText: { color: C.faint, marginTop: 8, fontSize: 14 },
  gh: { paddingTop: 52, paddingBottom: 14, paddingHorizontal: S.lg, backgroundColor: "rgba(255,255,255,0.92)", borderBottomLeftRadius: 22, borderBottomRightRadius: 22, borderBottomWidth: 1, borderColor: "rgba(15,23,42,0.06)", ...shadowSoft },
  ghRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ghIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(79,70,229,0.10)", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 },
  ghTitle: { color: C.ink, fontSize: 18, fontWeight: "800" },
  ghSub: { color: C.sub, fontSize: 12, marginTop: 1 },
  selectShadow: { borderRadius: R.md, ...shadowSoft },
  selectBlur: { borderRadius: R.md, overflow: "hidden", borderWidth: 1, borderColor: C.glassBorder },
  selectInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, backgroundColor: C.glass },
  selectText: { flex: 1, fontSize: 16, fontWeight: "600", color: C.ink },
  ddBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  ddSheet: { backgroundColor: "#fff", borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: 28 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 },
  ddTitle: { fontSize: 16, fontWeight: "800", color: C.ink, marginBottom: 6 },
  ddRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  ddRowText: { fontSize: 16, color: C.ink, fontWeight: "600" },
});
