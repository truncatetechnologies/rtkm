import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { DEPOTS, AVERAGES, calcOilFixed } from "@rtkm/shared";
import { searchPumps, countPumps } from "../../lib/db";
import { syncFromServer, submitPump } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { C, R, S, shadow, shadowSoft } from "../../lib/theme";
import { Card, AppButton, Chip, StepLabel, GradientHeader, Dropdown, ScreenBg, LinearGradient, MaterialCommunityIcons, Tile } from "../../components/ui";

const DEPOT_OPTIONS = DEPOTS.map((d) => ({ label: d.name, value: d.slug }));

export default function Calculator() {
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const [depot, setDepot] = useState(DEPOTS[0].slug);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [average, setAverage] = useState(4);
  const [price, setPrice] = useState("");
  const [cached, setCached] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    (async () => {
      setCached(await countPumps());
      try {
        setSyncing(true);
        const r = await syncFromServer();
        setCached(r.total); setSynced(true);
      } catch { setOffline(true); } finally { setSyncing(false); }
    })();
  }, []);

  const runSearch = useCallback(async (q, dep) => {
    if (!q.trim()) { setResults([]); return; }
    setResults(await searchPumps(dep, q, 25));
  }, []);
  useEffect(() => {
    const id = setTimeout(() => runSearch(query, depot), 200);
    return () => clearTimeout(id);
  }, [query, depot, runSearch]);

  const oil = useMemo(() => (selected ? calcOilFixed(selected.rtkm, average) : "0.00"), [selected, average]);
  const hasResult = !!selected;
  const priceNum = parseFloat(price) || 0;
  const total = selected && priceNum > 0 ? Math.round((parseFloat(oil) || 0) * priceNum) : null;
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

  const statusText = syncing ? `${t("startTyping") ? "" : ""}…` : offline ? t("offline") : synced ? t("synced") : `${cached} ${t("cached")}`;

  return (
    <ScreenBg>
      <GradientHeader
        title="RTKM"
        subtitle={t("tagline")}
        icon="gas-station"
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <View style={styles.langToggle}>
              {["en", "hi"].map((l) => (
                <TouchableOpacity key={l} onPress={() => setLang(l)} style={[styles.langBtn, lang === l && styles.langBtnActive]}>
                  <Text style={lang === l ? styles.langTextActive : styles.langText}>{l === "en" ? "EN" : "हिं"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => router.push("/fleet")} accessibilityRole="button" accessibilityLabel={t("login")}
              style={styles.loginBtn}>
              <MaterialCommunityIcons name="login" size={18} color={C.greenDark} />
              <Text style={styles.loginText} numberOfLines={1}>{t("login")}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 110 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* sync status pill */}
        <View style={[styles.statusPill, offline && { backgroundColor: C.amberLight }]}>
          <MaterialCommunityIcons
            name={syncing ? "sync" : offline ? "cloud-off-outline" : "cloud-check-outline"}
            size={15} color={offline ? C.amber : C.green}
          />
          <Text style={[styles.statusText, offline && { color: "#92400e" }]}>
            {syncing ? "Syncing…" : statusText}
          </Text>
        </View>

        {/* main card */}
        <Card style={{ marginTop: S.md }}>
          <StepLabel n="1">{t("depot")}</StepLabel>
          <Dropdown
            icon="office-building-marker"
            title={t("depot")}
            value={depot}
            options={DEPOT_OPTIONS}
            onChange={(v) => { setDepot(v); setSelected(null); setResults([]); setQuery(""); }}
          />

          <View style={{ height: S.xl }} />
          <StepLabel n="2">{t("pump")}</StepLabel>
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="gas-station" size={20} color={C.faint} />
            <TextInput
              value={query}
              onChangeText={(x) => { setQuery(x); setSelected(null); }}
              placeholder={t("startTyping")}
              placeholderTextColor={C.faint}
              style={styles.searchInput}
            />
            {selected && (
              <TouchableOpacity onPress={() => { setSelected(null); setQuery(""); }}>
                <MaterialCommunityIcons name="close-circle" size={20} color={C.faint} />
              </TouchableOpacity>
            )}
          </View>
          {results.length > 0 && !selected && (
            <View style={styles.dropdown}>
              {results.slice(0, 25).map((item) => (
                <TouchableOpacity key={item.id} style={styles.option}
                  onPress={() => { setSelected(item); setQuery(item.roName); setResults([]); }}>
                  <View style={styles.optIcon}><MaterialCommunityIcons name="gas-station" size={18} color={C.green} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optName} numberOfLines={1}>{item.roName}</Text>
                    <Text style={styles.optMeta}>{item.cmsCode} · {item.rtkm} {t("km")}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={C.faint} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity onPress={() => setShowSubmit(true)} style={styles.addLinkRow}>
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color={C.blue} />
            <Text style={styles.addLink}>{t("addMissing")}</Text>
          </TouchableOpacity>

          <View style={{ height: S.xl }} />
          <StepLabel n="3">{t("mileage")}</StepLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mileRow}>
            {AVERAGES.map((a) => (
              <Chip key={a} label={String(a)} active={average === a} onPress={() => setAverage(a)} />
            ))}
          </ScrollView>

          <View style={{ height: S.xl }} />
          <StepLabel n="4">{t("dieselPrice")}</StepLabel>
          <View style={styles.searchWrap}>
            <Text style={styles.rupeeSign}>₹</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder={t("pricePlaceholder")}
              placeholderTextColor={C.faint}
              keyboardType="decimal-pad"
              style={styles.searchInput}
            />
          </View>
        </Card>

        {/* result — bento: diesel litres + total amount side by side */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: S.lg }}>
          <Tile big style={{ flex: 1, minWidth: 0 }} label={t("diesel")} icon="fuel" tone="green"
            value={hasResult ? `${oil} ${t("litre")}` : "—"} sub={hasResult ? undefined : t("pickPumpHint")} />
          <Tile big style={{ flex: 1, minWidth: 0 }} label={t("totalAmount")} icon="cash" tone={total != null ? "green" : "indigo"}
            value={total != null ? inr(total) : "—"}
            sub={total != null ? `${oil} ${t("litre")} × ₹${priceNum}` : (!hasResult ? t("pickPumpHint") : t("enterPriceHint"))} />
        </View>

        {/* selected pump details */}
        {hasResult && (
          <Card soft style={{ marginTop: S.md }}>
            <DetailRow icon="barcode" label={t("roCode")} value={selected.cmsCode || "--"} />
            <DetailRow icon="map-marker-distance" label={t("rtkm")} value={`${selected.rtkm} ${t("km")}`} />
            <DetailRow icon="city" label={t("city")} value={selected.city || "--"} last={!selected.address} />
            {selected.address ? <DetailRow icon="map-marker" label={t("address")} value={selected.address} last /> : null}
            <View style={{ height: S.md }} />
            <AppButton title={t("details")} icon="map-search" variant="blue" onPress={() => router.push(`/pump/${selected.id}`)} />
          </Card>
        )}
      </ScrollView>

      <SubmitModal visible={showSubmit} depot={depot} t={t} onClose={() => setShowSubmit(false)} />
    </ScreenBg>
  );
}

function DetailRow({ icon, label, value, last }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <MaterialCommunityIcons name={icon} size={18} color={C.faint} style={{ width: 26 }} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function SubmitModal({ visible, depot, t, onClose }) {
  const [form, setForm] = useState({ roName: "", cmsCode: "", rtkm: "", address: "", submittedByName: "", submittedByPhone: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  async function submit() {
    setBusy(true);
    try {
      await submitPump({ depot, ...form, rtkm: Number(form.rtkm) || 0 });
      Alert.alert("✓", t("submittedOk")); onClose();
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t("addMissing")}</Text>
          {[["roName", "pump"], ["cmsCode", "roCode"], ["rtkm", "rtkm"], ["address", "address"], ["submittedByName", "name"], ["submittedByPhone", "yourPhone"]].map(([k, lbl]) => (
            <TextInput key={k} style={styles.mInput} placeholder={t(lbl)} placeholderTextColor={C.faint}
              keyboardType={k === "rtkm" ? "numeric" : k === "submittedByPhone" ? "phone-pad" : "default"}
              value={form[k]} onChangeText={set(k)} />
          ))}
          <View style={styles.modalBtns}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}><Text style={{ color: C.sub, fontWeight: "600" }}>{t("cancel")}</Text></TouchableOpacity>
            <AppButton title={busy ? "…" : t("submit")} onPress={submit} disabled={busy} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  langToggle: { flexDirection: "row", alignItems: "stretch", height: 40, borderRadius: R.sm, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.25)", flexShrink: 0 },
  langBtn: { paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  langBtnActive: { backgroundColor: "#fff" },
  langText: { color: "#fff", fontWeight: "700" }, langTextActive: { color: C.green, fontWeight: "800" },
  loginBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexShrink: 0, borderRadius: R.sm, backgroundColor: "#fff", paddingHorizontal: 14, height: 40, ...shadowSoft },
  loginText: { color: C.greenDark, fontWeight: "800", fontSize: 13 },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  statusText: { color: C.greenDark, fontSize: 12, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mileRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 4 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12, color: C.ink },
  rupeeSign: { fontSize: 18, fontWeight: "800", color: C.green, width: 20, textAlign: "center" },
  totalCard: { borderWidth: 1, borderColor: "rgba(16,185,129,0.35)", backgroundColor: "rgba(16,185,129,0.06)" },
  totalRupee: { fontSize: 20, fontWeight: "800" },
  dropdown: { backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: R.md, marginTop: 8, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  optIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center" },
  optName: { fontWeight: "700", color: C.ink, fontSize: 15 }, optMeta: { color: C.sub, fontSize: 12, marginTop: 1 },
  addLinkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  addLink: { color: C.blue, fontWeight: "700", fontSize: 14 },
  resultRow: { flexDirection: "row", alignItems: "center" },
  resultIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center", marginRight: 12 },
  resultLabel: { color: C.sub, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700" },
  resultHint: { color: C.faint, fontSize: 12, marginTop: 2 },
  resultValueWrap: { flexDirection: "row", alignItems: "flex-end" },
  resultValue: { color: C.green, fontSize: 36, fontWeight: "900", lineHeight: 38 },
  resultUnit: { color: C.sub, fontSize: 13, fontWeight: "700", marginLeft: 4, marginBottom: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  detailLabel: { color: C.sub, fontSize: 14, width: 92 },
  detailValue: { flex: 1, color: C.ink, fontWeight: "700", fontSize: 15, textAlign: "right" },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: 32 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12, color: C.ink },
  mInput: { backgroundColor: C.bg, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 10, color: C.ink },
  modalBtns: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: R.md, borderWidth: 1, borderColor: C.line },
});
