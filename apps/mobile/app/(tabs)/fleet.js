import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal, Image } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { getUser, setToken, setUser, getServerUrl, getToken } from "../../lib/config";
import {
  login, ownerRegister, getTransports, updateTransport, wipeTransport, getMembers, createMember, updateMember, getTrucks, createTruck, updateTruck,
  getLoads, getShortages, getSpend, getMyLoads, getMyPayslips,
  uploadInvoice, uploadShortage, confirmInvoice, confirmShortage, setMealAllowance,
  getMaintenance, createMaintenance, getSalaries, generateSalary, paySalary, discardSalary,
  getLeaves, addLeave, deleteLeave,
  getLedger, uploadLedger, getDriverShortage, gmailStatus, gmailMessages, gmailImport, gmailImportAll,
  getUploads, revertUpload, clearApiCache,
  getExtraOil, addExtraOil, deleteExtraOil, getExtraOilReport, getCompanies,
  getMyMeterReadings, getMeterReadings, submitMyMeterReading, submitMeterReading,
  getNotifications, markNotificationsRead, checkNotifications, registerPush, getProfitability,
  getFastagReport, uploadFastag, markFastagCharge, getGateIns, syncGateIns, getVehicleAlerts, syncVehicleAlerts,
  registerAdminPush, getAdminTransports, getAdminTransport, getRtkmRequests, decideRtkmRequest, markAdminNotificationsRead,
} from "../../lib/api";
import { registerForPush } from "../../lib/push";
import { C, R, S, shadow } from "../../lib/theme";
import { Card, AppButton, Chip, Tile, GradientHeader, EmptyState, ScreenBg, MaterialCommunityIcons, LinearGradient } from "../../components/ui";

const rupee = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

// Multi-line payslip breakdown for the details dialog: base, additions, each deduction, net.
function payslipDetail(p) {
  const lines = [`Base pay (${p.payableDays}/${p.daysInMonth} days): ${rupee(p.baseSalary)}`];
  (p.additions || []).forEach((a) => lines.push(`+ ${a.reason || "Addition"}: ${rupee(a.amount)}`));
  if (!p.deductions || p.deductions.length === 0) lines.push("No deductions.");
  else p.deductions.forEach((d) => lines.push(`− ${d.reason || "Deduction"}: ${rupee(d.amount)}`));
  lines.push(`Net pay: ${rupee(p.netPay)}`);
  return lines.join("\n");
}

export default function Fleet() {
  const [user, setUserState] = useState(undefined);
  useEffect(() => { getUser().then((u) => setUserState(u || null)); }, []);
  async function logout() { await clearApiCache(); await setToken(null); await setUser(null); setUserState(null); }

  if (user === undefined) return <View style={s.screen} />;
  if (!user) return <AuthScreen onAuthed={setUserState} />;
  if (user.role === "admin") return <AdminFleet user={user} onLogout={logout} />;
  if (user.role === "driver") return <DriverFleet user={user} onLogout={logout} />;
  return <OwnerFleet user={user} onLogout={logout} />;
}

// Admin (the platform owner) on mobile: view-only oversight of every transporter +
// the RTKM approval queue, and OS push for each new approval. Pumps/owners stay on web.
function AdminFleet({ user, onLogout }) {
  const [tab, setTab] = useState("approvals");
  const [requests, setRequests] = useState([]);
  const [pending, setPending] = useState(0);
  const [transports, setTransports] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    try { const r = await getRtkmRequests("pending"); setRequests(r.requests || []); setPending(r.pending || 0); } catch {}
    try { setTransports(await getAdminTransports()); } catch {}
    markAdminNotificationsRead().catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // Register this device for admin push so approvals arrive even when the app is closed.
  useEffect(() => { registerForPush((token) => registerAdminPush(token)).catch(() => {}); }, []);

  async function decide(id, action) {
    setBusyId(id);
    try { await decideRtkmRequest(id, action); await refresh(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); }
    finally { setBusyId(null); }
  }

  if (openId) return <AdminTransportDetail id={openId} onBack={() => setOpenId(null)} />;

  return (
    <ScreenBg>
      <GradientHeader title={`Hi, ${user.name}`} subtitle="Admin" icon="shield-check"
        right={<TouchableOpacity onPress={onLogout}><MaterialCommunityIcons name="logout" size={22} color="#fff" /></TouchableOpacity>} />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: S.md }}>
          <Chip label={`Approvals${pending ? ` (${pending})` : ""}`} active={tab === "approvals"} onPress={() => setTab("approvals")} icon="check-decagram" />
          <Chip label="Transporters" active={tab === "transporters"} onPress={() => setTab("transporters")} icon="truck" />
        </View>

        {tab === "approvals" && (
          <>
            {requests.length === 0
              ? <EmptyState icon="check-all" text="No pending approvals. RTKM change requests from transporters will appear here." />
              : requests.map((r) => (
                <Card key={r.id} style={{ marginBottom: S.md }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: C.ink }}>{r.roName || r.cmsCode}</Text>
                  <Text style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{r.cmsCode}{r.invoiceNumber ? ` · inv ${r.invoiceNumber}` : ""}{r.source ? ` · ${r.source}` : ""}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: C.ink }}>{r.currentRtkm}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={18} color={C.faint} />
                    <Text style={{ fontSize: 22, fontWeight: "900", color: C.green }}>{r.proposedRtkm}</Text>
                    <Text style={{ fontSize: 13, color: C.sub }}>km</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <AppButton title="Approve" icon="check" onPress={() => decide(r.id, "approve")} loading={busyId === r.id} style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => decide(r.id, "reject")} disabled={busyId === r.id}
                      style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: R.md, borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2" }}>
                      <Text style={{ color: "#e11d48", fontWeight: "800" }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
          </>
        )}

        {tab === "transporters" && (
          <>
            {transports.length === 0
              ? <EmptyState icon="truck" text="No transporters yet." />
              : transports.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => setOpenId(t.id)} activeOpacity={0.7}>
                  <ListRow icon="truck" title={`${t.name}${t.active ? "" : " (inactive)"}`}
                    meta={`${t.ownerName} · ${t.tankers} tankers · ${t.drivers} drivers · ${t.loads} loads`}
                    right="view" rightTone="blue" />
                </TouchableOpacity>
              ))}
          </>
        )}
      </ScrollView>
    </ScreenBg>
  );
}

// One transporter's detail (view-only): per-tanker km/loads + driver salaries for a month.
function AdminTransportDetail({ id, onBack }) {
  const [d, setD] = useState(null);
  const [period, setPeriod] = useState("");
  useEffect(() => {
    let alive = true;
    getAdminTransport(id, period).then((data) => { if (alive && data) { setD(data); if (!period && data.period) setPeriod(data.period); } }).catch(() => {});
    return () => { alive = false; };
  }, [id, period]);

  if (!d) return <ScreenBg><GradientHeader title="Transporter" icon="truck" /><View style={{ padding: S.lg }}><Text style={{ color: C.sub }}>Loading…</Text></View></ScreenBg>;
  const t = d.totals;

  return (
    <ScreenBg>
      <GradientHeader title={d.transport.name} subtitle={`Owner: ${d.transport.ownerName}`} icon="truck"
        right={<TouchableOpacity onPress={onBack}><MaterialCommunityIcons name="close" size={22} color="#fff" /></TouchableOpacity>} />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {d.months.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4, marginBottom: S.md }}>
            {d.months.map((m) => <Chip key={m} label={m} active={m === period} onPress={() => setPeriod(m)} />)}
          </ScrollView>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: S.md }}>
          <Tile label="Tankers/Trucks" value={`${t.tankers}/${t.trucks}`} icon="truck" tone="indigo" />
          <Tile label="Loads (month)" value={String(t.loads)} icon="package-variant" tone="teal" />
          <Tile label="Km run (month)" value={(t.meteredKm || t.tripKm).toLocaleString("en-IN")} icon="speedometer" tone="blue" />
          <Tile label="Salary paid" value={rupee(t.salaryPaid)} icon="wallet" tone="green" />
        </View>

        <Text style={[s.section, { marginTop: S.sm }]}>Tankers — {period}</Text>
        {d.tankers.length === 0 ? <Text style={s.rowMeta}>No tankers.</Text> :
          d.tankers.map((r) => (
            <ListRow key={r.id} icon={r.type === "tanker" ? "tanker-truck" : "truck"} title={r.registrationNo}
              meta={`${r.loads} loads · ${r.meterReadings > 1 ? km(r.meteredKm) + " (meter)" : km(r.tripKm) + " (RTKM)"}`}
              right={rupee(r.cargo).replace("₹", "") + " L"} />
          ))}

        <Text style={[s.section, { marginTop: S.lg }]}>Drivers — {period}</Text>
        {d.drivers.length === 0 ? <Text style={s.rowMeta}>No drivers.</Text> :
          d.drivers.map((r) => (
            <ListRow key={r.id} icon="account" title={r.name}
              meta={`monthly ${rupee(r.monthlySalary)} · ${r.loads} loads · ${r.salaryStatus === "none" ? "no slip" : r.salaryStatus}`}
              right={r.salaryPaid == null ? "—" : rupee(r.salaryPaid)} rightTone={r.salaryStatus === "paid" ? "green" : undefined} />
          ))}
      </ScrollView>
    </ScreenBg>
  );
}
const km = (n) => `${Math.round(n || 0).toLocaleString("en-IN")} km`;

function LInput({ icon, ...props }) {
  return (
    <View style={s.inputWrap}>
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={C.faint} /> : null}
      <TextInput style={s.input} placeholderTextColor={C.faint} {...props} />
    </View>
  );
}

// ---------------- Auth ----------------
const AUTH_FEATURES = [
  { icon: "shield-check", label: "Role-based access" },
  { icon: "chart-line", label: "Live analytics" },
  { icon: "wallet", label: "Auto-reconciled" },
];

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", phone: "", pin: "" });
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function submit() {
    setBusy(true);
    try {
      const data = mode === "login" ? await login({ phone: f.phone, pin: f.pin }) : await ownerRegister(f);
      await setToken(data.token); await setUser(data.user); onAuthed(data.user);
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <ScreenBg>
      <LinearGradient colors={[C.gradFrom, C.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.authHero}>
        <View style={s.authLogo}><MaterialCommunityIcons name="truck-fast" size={34} color="#fff" /></View>
        <Text style={s.authTitle}>RTKM</Text>
        <Text style={s.authSub}>Transport Management</Text>
      </LinearGradient>
      <View style={{ padding: S.lg, marginTop: -24 }}>
        <Card>
          <Text style={s.authCardTitle}>{mode === "login" ? "Welcome back" : "Create your account"}</Text>
          <Text style={s.authCardSub}>{mode === "login" ? "Sign in with your phone number and PIN." : "Owners register here — managers & drivers are added later."}</Text>
          <View style={s.segment}>
            {[["login", "Log in"], ["register", "Register"]].map(([m, lbl]) => (
              <TouchableOpacity key={m} style={[s.segBtn, mode === m && s.segBtnActive]} onPress={() => setMode(m)}>
                <Text style={mode === m ? s.segTextActive : s.segText}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {mode === "register" && <LInput icon="office-building" placeholder="Name / company" value={f.name} onChangeText={set("name")} />}
          <LInput icon="phone" placeholder="Phone number" keyboardType="phone-pad" value={f.phone} onChangeText={set("phone")} />
          <View style={s.inputWrap}>
            <MaterialCommunityIcons name="lock" size={20} color={C.faint} />
            <TextInput style={s.input} placeholderTextColor={C.faint} placeholder="PIN" secureTextEntry={!showPin} keyboardType={showPin ? "default" : "numeric"} value={f.pin} onChangeText={set("pin")} />
            <TouchableOpacity onPress={() => setShowPin((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.authShow}>{showPin ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          <AppButton title={mode === "login" ? "Log in" : "Create owner account"} icon="login" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
          {mode === "register" && <Text style={s.authNote}>Only transport owners self-register. Managers & drivers are added by the owner.</Text>}
        </Card>
        <View style={s.authFeatures}>
          {AUTH_FEATURES.map((ft) => (
            <View key={ft.label} style={s.authFeat}>
              <MaterialCommunityIcons name={ft.icon} size={18} color={C.green} />
              <Text style={s.authFeatText}>{ft.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenBg>
  );
}

// ---------------- Driver ----------------
function DriverFleet({ user, onLogout }) {
  const [loads, setLoads] = useState([]);
  const [pay, setPay] = useState({ payslips: [], openShortages: [], summary: {} });
  const [readings, setReadings] = useState([]);
  const [modal, setModal] = useState(null);
  const load = useCallback(async () => {
    try { setLoads(await getMyLoads()); setPay(await getMyPayslips()); } catch {}
    try { setReadings(await getMyMeterReadings()); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const lastSlip = pay.payslips[0];
  const summary = pay.summary || {};
  const pending = summary.openShortageValue ?? pay.openShortages.reduce((a, x) => a + (x.shortageValue || 0), 0);
  const invoiceById = Object.fromEntries(loads.map((l) => [l.id, l.invoiceNumber || l.id.slice(-6)]));

  return (
    <ScreenBg>
      <GradientHeader title={`Hi, ${user.name}`} subtitle="Driver" icon="account"
        right={<TouchableOpacity onPress={onLogout}><MaterialCommunityIcons name="logout" size={22} color="#fff" /></TouchableOpacity>} />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={s.tiles}>
          <Tile label="My trips" value={loads.length} icon="truck-check" />
          <Tile label="Last payslip" value={lastSlip ? rupee(lastSlip.netPay) : "—"} icon="cash" tone="green" />
          <Tile label="Pending salary" value={rupee(summary.pendingSalary || 0)} icon="cash-clock" tone="amber" />
          <Tile label="Pending cut" value={rupee(pending)} icon="cash-minus" tone="rose" />
        </View>
        <View style={s.actionRow}>
          <AppButton title="Meter reading" icon="camera" onPress={() => setModal("meter")} style={{ flex: 1 }} />
          <AppButton title="Upload invoice" icon="file-upload" variant="light" onPress={() => setModal("invoice")} style={{ flex: 1 }} />
        </View>
        <View style={[s.actionRow, { marginTop: 10 }]}>
          <AppButton title="Shortage PDF" icon="file-alert" variant="danger" onPress={() => setModal("shortage")} style={{ flex: 1 }} />
        </View>

        <Text style={s.section}>My recent trips</Text>
        {loads.length === 0 ? <EmptyState icon="truck-outline" text="No trips yet" /> :
          loads.slice(0, 20).map((l) => (
            <ListRow key={l.id} icon="receipt" title={l.invoiceNumber || "—"}
              meta={`${l.fromLocation || "?"} → ${l.toLocation || "?"} · ${l.loadQtyL}L`}
              right={l.shortageL ? `${l.shortageL}L` : ""} rightTone={l.shortageL ? "red" : null} />
          ))}

        <Text style={s.section}>My shortages</Text>
        {pay.openShortages.length === 0 ? <EmptyState icon="check-circle-outline" text="No open shortages" /> :
          pay.openShortages.map((x) => (
            <ListRow key={x.id} icon="alert" title={x.invoiceNumber || "—"}
              meta={`${x.shortageL}L · ${x.status}${x.reportedAt ? ` · ${new Date(x.reportedAt).toLocaleDateString("en-IN")}` : ""}`}
              right={rupee(x.shortageValue)} rightTone="red" />
          ))}

        <Text style={s.section}>My payslips</Text>
        {pay.payslips.length === 0 ? <EmptyState icon="cash-multiple" text="No payslips yet" /> :
          pay.payslips.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => Alert.alert(`Payslip · ${p.period}`, payslipDetail(p))} activeOpacity={0.7}>
              <ListRow icon="cash" title={p.period}
                meta={`base ${rupee(p.baseSalary)}${p.daysInMonth ? ` (${p.payableDays}/${p.daysInMonth}d${p.leaveDays ? `, ${p.leaveDays} leave` : ""})` : ""} − cuts ${rupee(p.deductions.reduce((a, d) => a + d.amount, 0))} · tap for details`}
                right={rupee(p.netPay)} rightTone={p.status === "paid" ? "green" : null} />
            </TouchableOpacity>
          ))}

        <Text style={s.section}>My meter readings</Text>
        {readings.length === 0 ? <EmptyState icon="gauge-empty" text="No meter readings yet" /> :
          readings.map((r) => (
            <ListRow key={r.id} icon="gauge" title={`${r.readingKm.toLocaleString("en-IN")} km`}
              meta={`${invoiceById[r.loadId] || "trip"} · ${new Date(r.recordedAt).toLocaleDateString("en-IN")}${r.notes ? ` · ${r.notes}` : ""}`}
              right={r.hasPhoto ? "📷" : ""} />
          ))}
      </ScrollView>
      {modal === "meter" && <MeterReadingModal loads={loads} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {(modal === "invoice" || modal === "shortage") && <UploadModal kind={modal} transportId={user.transportId} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </ScreenBg>
  );
}

// Pick an image from camera or library and return the asset (or null).
async function pickMeterPhoto(useCamera) {
  const fn = useCamera ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
  const perm = await fn();
  if (!perm.granted) { Alert.alert("Permission needed", `Allow ${useCamera ? "camera" : "photo"} access to attach a meter photo.`); return null; }
  const res = useCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ["images"] });
  if (res.canceled) return null;
  return res.assets?.[0] || null;
}

// Driver records the truck odometer for a trip, optionally with a photo. `onSubmit(fields, asset)`
// is the API call (driver self vs transporter). Reused on the owner screen with a driver picker.
function MeterReadingModal({ loads, onClose, onDone, drivers, onSubmit, title = "Add meter reading" }) {
  const [loadId, setLoadId] = useState(loads[0]?.id || "");
  const [driverId, setDriverId] = useState("");
  const [readingKm, setReadingKm] = useState("");
  const [notes, setNotes] = useState("");
  const [asset, setAsset] = useState(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!loadId) { Alert.alert("Trip", "Pick a trip."); return; }
    if (!(Number(readingKm) > 0)) { Alert.alert("Reading", "Enter the meter reading (km)."); return; }
    setBusy(true);
    try {
      const fields = { loadId, readingKm, notes };
      if (drivers) { fields.driverId = driverId; }
      await (onSubmit || submitMyMeterReading)(fields, asset);
      onDone();
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <Text style={s.fieldHint}>Trip</Text>
      <View style={s.chips}>
        {loads.length === 0 ? <Text style={s.rowMeta}>No trips yet.</Text> :
          loads.slice(0, 30).map((l) => (
            <Chip key={l.id} label={`${l.invoiceNumber || l.id.slice(-6)}${l.toLocation ? ` · ${l.toLocation}` : ""}`} active={loadId === l.id} onPress={() => setLoadId(l.id)} />
          ))}
      </View>
      {drivers && (
        <>
          <Text style={s.fieldHint}>Driver (optional — defaults to the trip's driver)</Text>
          <View style={s.chips}>
            <Chip label="From trip" active={!driverId} onPress={() => setDriverId("")} />
            {drivers.map((d) => <Chip key={d.id} label={d.name} active={driverId === d.id} onPress={() => setDriverId(d.id)} />)}
          </View>
        </>
      )}
      <View style={{ height: 6 }} />
      <LInput icon="gauge" placeholder="Meter reading (km)" keyboardType="numeric" value={readingKm} onChangeText={setReadingKm} />
      <LInput icon="text" placeholder="Notes (optional)" value={notes} onChangeText={setNotes} />
      <View style={s.actionRow}>
        <AppButton title={asset ? "Photo ✓ retake" : "Take photo"} icon="camera" variant="light" onPress={async () => { const a = await pickMeterPhoto(true); if (a) setAsset(a); }} style={{ flex: 1 }} />
        <AppButton title="From gallery" icon="image" variant="light" onPress={async () => { const a = await pickMeterPhoto(false); if (a) setAsset(a); }} style={{ flex: 1 }} />
      </View>
      <View style={{ height: 10 }} />
      <AppButton title={busy ? "Saving…" : "Save reading"} icon="content-save" onPress={save} loading={busy} />
      <CancelBtn onClose={onClose} />
    </Sheet>
  );
}

// ---------------- Owner / Manager ----------------
// Day-to-day operations (top row).
const OPS_TABS = [
  { key: "overview", label: "Overview", icon: "view-dashboard" },
  { key: "loads", label: "Loads", icon: "truck" },
  { key: "ledger", label: "Statement Of Freight", icon: "clipboard-list" },
  { key: "shortages", label: "Shortage Cuts", icon: "alert" },
  { key: "meterReadings", label: "Meter Readings", icon: "gauge" },
  { key: "maintenance", label: "Maintenance", icon: "wrench" },
  { key: "fastag", label: "FASTag / Tolls", icon: "boom-gate" },
  { key: "gatein", label: "Gate In", icon: "warehouse" },
  { key: "alerts", label: "Alerts", icon: "bell-alert" },
  { key: "salaries", label: "Salaries", icon: "cash" },
  { key: "reports", label: "Reports", icon: "chart-bar" },
];
// Configuration & tools (grouped under the "Settings" chip → second sub-row).
const SETUP_TABS = [
  { key: "drivers", label: "Drivers", icon: "account-group" },
  { key: "trucks", label: "Trucks", icon: "dump-truck" },
  { key: "managers", label: "Managers", icon: "account-tie" },
  { key: "uploads", label: "Uploads (Undo)", icon: "history" },
];
const SETUP_KEYS = SETUP_TABS.map((t) => t.key);

const EXTRA_REASONS = [
  ["breakdown", "Breakdown"],
  ["route_change", "Route change"],
  ["route_issue", "Route issue / detour"],
  ["other", "Other"],
];
const reasonLabel = (r) => EXTRA_REASONS.find(([k]) => k === r)?.[1] || r;

const COMPANY_LABEL = { nayara: "Nayara", bpcl: "BPCL", ioc: "IOC", hpcl: "HPCL" };
const companyLabel = (c) => COMPANY_LABEL[c] || (c ? c.toUpperCase() : "All");
const monthShort = (m) => { if (!m) return "—"; const [y, mo] = m.split("-"); return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }); };
const fmtDay = (x) => (x ? new Date(x).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }) : "—");

const UPLOAD_KIND = {
  invoice: { label: "Invoice", icon: "file-document" },
  freight: { label: "Statement of Freight", icon: "clipboard-list" },
  payment: { label: "Bank Payment Advice", icon: "bank" },
};

// Club loads that share a Shipment No. Oil is given once per shipment, for the farthest pump only.
// Extra oil entries are matched to their shipment (or, for a solo load, by loadId).
function groupByShipment(loads, extra) {
  const map = new Map();
  for (const l of loads || []) {
    const key = l.shipmentNo || `solo:${l.id}`;
    if (!map.has(key)) map.set(key, { shipmentNo: l.shipmentNo || "", loads: [] });
    map.get(key).loads.push(l);
  }
  return [...map.values()].map((g) => {
    const loadIds = new Set(g.loads.map((l) => l.id));
    const extraEntries = (extra || []).filter((e) => (g.shipmentNo ? e.shipmentNo === g.shipmentNo : (e.loadId && loadIds.has(e.loadId))));
    const lead = g.loads.reduce((a, l) => ((l.rtkm || 0) > (a.rtkm || 0) ? l : a), g.loads[0]);
    return {
      ...g,
      lead,
      extraEntries,
      pumps: g.loads.length,
      cargo: g.loads.reduce((s, l) => s + (l.loadQtyL || 0), 0),
      freight: g.loads.reduce((s, l) => s + (l.freightAmount || 0), 0),
      maxRtkm: g.loads.reduce((m, l) => Math.max(m, l.rtkm || 0), 0),
      oil: g.loads.reduce((m, l) => Math.max(m, l.shipmentOilLiters || 0), 0),
      oilCost: g.loads.reduce((s, l) => s + (l.oilCost || 0), 0),
      meal: g.loads.reduce((s, l) => s + (l.mealAllowance || 0), 0),
      extraL: extraEntries.reduce((s, e) => s + (e.litres || 0), 0),
      extraCost: extraEntries.reduce((s, e) => s + (e.cost || 0), 0),
    };
  });
}

const SPEND_RANGES = [
  { key: "all", label: "All time" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "3m", label: "3 months" },
  { key: "year", label: "This year" },
];

// A preset key → { from, to } ISO strings for the spend API ({} = all time).
function presetParams(key) {
  if (key === "all") return {};
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  let from;
  if (key === "week") { const dow = (now.getDay() + 6) % 7; from = new Date(now); from.setDate(now.getDate() - dow); }
  else if (key === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (key === "3m") from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  else from = new Date(now.getFullYear(), 0, 1); // year
  return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() };
}

function OwnerFleet({ user, onLogout }) {
  const [transports, setTransports] = useState([]);
  const [tid, setTid] = useState(user.transportId || null);
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("all");
  const [spend, setSpend] = useState(null);
  const [loads, setLoads] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [managers, setManagers] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [ledger, setLedger] = useState({ loads: [], summary: {} });
  const [driverShortage, setDriverShortage] = useState({ rows: [], totals: {} });
  const [uploads, setUploads] = useState([]);
  const [meterReadings, setMeterReadings] = useState([]);
  const [extraOil, setExtraOil] = useState([]);
  const [extraReport, setExtraReport] = useState({ byDriver: [], byTruck: [], totals: {} });
  const [extraGroup, setExtraGroup] = useState(null); // shipment group we're adding extra oil to
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all"); // active oil company / depot filter
  const [notifs, setNotifs] = useState({ notifications: [], unread: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const [profit, setProfit] = useState({ rows: [], totals: {} });
  const [fastag, setFastag] = useState({ totals: {}, byTruck: [], byMonth: [], tolls: [], months: [], flags: [], topPlazas: [] });
  const [fastagPeriod, setFastagPeriod] = useState("");
  const [fastagBusy, setFastagBusy] = useState(false);
  const [gateIn, setGateIn] = useState({ rows: [], total: 0, byDepot: [] });
  const [gateInBusy, setGateInBusy] = useState(false);
  const [alerts, setAlerts] = useState({ rows: [], total: 0 });
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (user.role === "owner") getTransports().then((t) => { setTransports(t); if (!tid && t[0]) setTid(t[0].id); }).catch(() => {});
  }, []);
  const refresh = useCallback(async () => {
    if (!tid) return;
    try {
      const { from, to } = presetParams(range);
      setSpend(await getSpend(tid, from, to, company)); setLoads(await getLoads(tid)); setShortages(await getShortages(tid));
      setDrivers(await getMembers(tid, "driver")); setTrucks(await getTrucks(tid));
      setMaintenance(await getMaintenance(tid)); setManagers(await getMembers(tid, "manager"));
      setSalaries(await getSalaries(tid)); setLedger(await getLedger(tid, company, from, to));
      setDriverShortage(await getDriverShortage(tid));
      setUploads(await getUploads(tid));
      setMeterReadings(await getMeterReadings(tid));
      setExtraOil(await getExtraOil(tid));
      setExtraReport(await getExtraOilReport(tid));
      getCompanies(tid).then((c) => { setCompanies(c || []); if (company !== "all" && !(c || []).includes(company)) setCompany("all"); }).catch(() => {});
      getNotifications(tid).then(setNotifs).catch(() => {});
      getProfitability(tid).then(setProfit).catch(() => {});
      getFastagReport(tid, fastagPeriod).then(setFastag).catch(() => {});
      getGateIns(tid).then(setGateIn).catch(() => {});
      getVehicleAlerts(tid).then(setAlerts).catch(() => {});
    } catch {}
  }, [tid, range, company]);
  async function syncGate() {
    setGateInBusy(true);
    try {
      const r = await syncGateIns(tid, 365);
      Alert.alert("Gate In synced", `Scanned ${r.scanned} email(s), ${r.created} new gate event(s) added.`);
      getGateIns(tid).then(setGateIn).catch(() => {});
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setGateInBusy(false); }
  }
  async function syncAlerts() {
    setAlertsBusy(true);
    try {
      const r = await syncVehicleAlerts(tid, 365);
      Alert.alert("Alerts synced", `Scanned ${r.scanned} email(s), ${r.created} new alert(s) added.`);
      getVehicleAlerts(tid).then(setAlerts).catch(() => {});
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setAlertsBusy(false); }
  }
  async function pickFastag() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: true });
      if (res.canceled) return;
      setFastagBusy(true);
      let tag = 0, boss = 0, fail = 0, dup = 0;
      for (const a of res.assets || []) { try { const r = await uploadFastag(a, tid); if (r.duplicate) dup++; else if (r.kind === "tag") tag++; else if (r.kind === "boss") boss++; else fail++; } catch { fail++; } }
      Alert.alert("FASTag imported", `${tag} tanker, ${boss} wallet${dup ? `, ${dup} duplicate (skipped)` : ""}${fail ? `, ${fail} not recognised` : ""}.`);
      refresh();
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setFastagBusy(false); }
  }
  function reviewCharge(c) {
    Alert.alert(`${c.desc} · ${rupee(c.amount)}`, `Txn ${c.txnId || "—"}${c.vehicleNo ? " · " + c.vehicleNo : ""}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Dispute (false)", style: "destructive", onPress: async () => { try { await markFastagCharge(c.id, "disputed", ""); refresh(); } catch (e) { Alert.alert("Error", String(e.message || e)); } } },
      { text: "Expected", onPress: async () => { try { await markFastagCharge(c.id, "expected", ""); refresh(); } catch (e) { Alert.alert("Error", String(e.message || e)); } } },
    ]);
  }
  // Scan the connected Gmail for new invoices/PDFs when the transport opens.
  useEffect(() => { if (tid) checkNotifications(tid).then(() => getNotifications(tid).then(setNotifs)).catch(() => {}); }, [tid]);
  // Register this device for OS push (no-op on simulators / without an EAS build).
  useEffect(() => { if (tid) registerForPush((token) => registerPush(tid, token)).catch(() => {}); }, [tid]);
  useEffect(() => { if (tid) getFastagReport(tid, fastagPeriod).then(setFastag).catch(() => {}); }, [tid, fastagPeriod]);
  async function openNotifs() {
    setNotifOpen(true);
    if (notifs.unread > 0) { try { await markNotificationsRead(tid); setNotifs((n) => ({ ...n, unread: 0 })); } catch {} }
  }
  useEffect(() => { refresh(); }, [refresh]);

  const t = spend?.totals || { total: 0, fuel: 0, trips: 0, trucks: 0, drivers: 0, shortageL: 0, maintenance: 0, oilLiters: 0 };
  const activeTransport = transports.find((x) => x.id === tid) || null;
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";
  const truckName = (id) => { const tk = trucks.find((x) => x.id === id); return tk ? (tk.name || tk.registrationNo) : "—"; };
  function markPaid(p) {
    const btns = [{ text: "Close", style: "cancel" }];
    if (p.status === "draft") {
      btns.push({ text: "Discard", style: "destructive", onPress: async () => { try { await discardSalary(p.id); refresh(); } catch (e) { Alert.alert("Error", String(e.message || e)); } } });
      btns.push({ text: "Mark paid", onPress: async () => { try { await paySalary(p.id); refresh(); } catch (e) { Alert.alert("Error", String(e.message || e)); } } });
    }
    Alert.alert(`Payslip · ${driverName(p.driverId)} · ${p.period}`, payslipDetail(p), btns);
  }
  async function toggleDriverAccess(d) {
    try { await updateMember(d.id, { appAccessEnabled: !d.appAccessEnabled }); refresh(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); }
  }
  async function removeExtraOil(e) {
    Alert.alert("Delete entry?", `Remove ${e.litres}L extra oil for ${e.driverName || "driver"}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await deleteExtraOil(e.id); refresh(); } catch (err) { Alert.alert("Error", String(err.message || err)); } } },
    ]);
  }
  async function undoUpload(u) {
    if (u.reverted) return;
    Alert.alert("Undo this upload?", `This removes everything this ${UPLOAD_KIND[u.kind]?.label || "upload"} created${u.affectedCount ? " and un-settles the deliveries it settled" : ""}. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: async () => {
        try { const r = await revertUpload(u.id); Alert.alert("Reverted", `${r.deletedLoads || 0} deliveries, ${r.deletedShortages || 0} shortages removed, ${r.unsettled || 0} un-settled.`); refresh(); }
        catch (e) { Alert.alert("Error", String(e.message || e)); }
      } },
    ]);
  }

  return (
    <ScreenBg>
      <GradientHeader title={user.name} subtitle={`Transport ${user.role}`} icon="truck-fast"
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <TouchableOpacity onPress={openNotifs}>
              <MaterialCommunityIcons name="bell-outline" size={23} color="#fff" />
              {notifs.unread > 0 && (
                <View style={{ position: "absolute", top: -5, right: -6, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{notifs.unread > 9 ? "9+" : notifs.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onLogout}><MaterialCommunityIcons name="logout" size={22} color="#fff" /></TouchableOpacity>
          </View>
        } />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {user.role === "owner" && transports.length > 0 && (
          <View style={[s.chips, { marginBottom: S.md }]}>
            {transports.map((tr) => <Chip key={tr.id} label={tr.name} icon="domain" active={tid === tr.id} onPress={() => setTid(tr.id)} />)}
          </View>
        )}
        {!tid ? (
          <EmptyState icon="domain" text="No transport yet. Create one on the web dashboard." />
        ) : (
          <>
            {companies.length >= 2 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: S.md }}>
                <MaterialCommunityIcons name="gas-station" size={16} color={C.sub} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Chip label="All" active={company === "all"} onPress={() => setCompany("all")} />
                  {companies.map((c) => <Chip key={c} label={companyLabel(c)} active={company === c} onPress={() => setCompany(c)} />)}
                </ScrollView>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {OPS_TABS.map((x) => (
                <Chip key={x.key} label={x.label} icon={x.icon} active={tab === x.key} onPress={() => setTab(x.key)} />
              ))}
              <Chip label="Settings" icon="cog" active={SETUP_KEYS.includes(tab)} onPress={() => { if (!SETUP_KEYS.includes(tab)) setTab(SETUP_TABS[0].key); }} />
            </ScrollView>
            {SETUP_KEYS.includes(tab) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 4 }}>
                {SETUP_TABS.map((x) => (
                  <Chip key={x.key} label={x.label} icon={x.icon} active={tab === x.key} onPress={() => setTab(x.key)} />
                ))}
              </ScrollView>
            )}

            {tab === "overview" && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: S.md }}>
                  {SPEND_RANGES.map((p) => (
                    <Chip key={p.key} label={p.label} active={range === p.key} onPress={() => setRange(p.key)} />
                  ))}
                </ScrollView>

                {/* Fleet counts — compact, next to the period filter */}
                <View style={[s.tiles, { marginTop: S.md }]}>
                  <Tile label="Trucks" value={t.trucks} icon="dump-truck" />
                  <Tile label="Drivers" value={t.drivers} icon="account-group" tone="blue" />
                </View>

                {/* First eye — money you're chasing today */}
                {(() => {
                  const L = ledger.summary || {};
                  const settledPct = L.loads ? (L.settled / L.loads) * 100 : 0;
                  const collPct = L.totalFreight ? (L.totalReceived / L.totalFreight) * 100 : 0;
                  const allSettled = L.loads > 0 && L.pending === 0;
                  return (
                    <View style={{ marginTop: S.md, gap: 10 }}>
                      <RingStatRN colors={allSettled ? ["#0d9488", "#047857"] : ["#f59e0b", "#b45309"]} percent={settledPct}
                        value={rupee(L.pendingFreight)} label={allSettled ? "All settled — nothing pending" : "Settlement pending"}
                        sub={`${L.settled || 0}/${L.loads || 0} settled by bank`} />
                      <RingStatRN colors={["#2563eb", "#1e3a8a"]} percent={collPct}
                        value={rupee(L.totalReceived)} label="Received in bank" sub={`of ${rupee(L.totalFreight)} freight`} />
                    </View>
                  );
                })()}

                {/* Operating spend */}
                <View style={[s.tiles, { marginTop: S.md }]}>
                  <Tile label="Total spend" value={rupee(t.total)} icon="cash-multiple" tone="green" />
                  <Tile label="Trips" value={t.trips} icon="truck-check" tone="teal" />
                  <Tile label="Fuel" value={rupee(t.fuel)} icon="fuel" />
                  <Tile label="Diesel given" value={`${Math.round(t.oilLiters || 0)} L`} icon="fuel" tone="blue" />
                  <Tile label="Extra diesel" value={`${Math.round(t.extraOilL || 0)} L`} icon="fuel" tone="rose" />
                  <Tile label="Tolls" value={rupee(t.fastag)} icon="boom-gate" tone="indigo" />
                  <Tile label="Meal allowance" value={rupee(t.mealAllowance)} icon="food" tone="blue" />
                  <Tile label="Invoices pending" value={t.pendingInvoice || 0} icon="file-alert" tone="amber" />
                  <Tile label="Shortage" value={`${(t.shortageL || 0).toFixed(0)} L`} icon="alert" tone="amber" />
                </View>
                {user.role === "owner" && activeTransport && (
                  <OilAvgCard transport={activeTransport} onSaved={refresh} />
                )}
                {user.role === "owner" && activeTransport && (
                  <DangerCard transport={activeTransport} onWiped={refresh} />
                )}
              </>
            )}

            {tab === "loads" && (
              <View style={{ marginTop: S.md }}>
                {loads.length === 0 ? <EmptyState icon="truck-outline" text="No loads" /> :
                  loads.map((l) => <ListRow key={l.id} icon="receipt" title={l.invoiceNumber || "—"}
                    meta={`${driverName(l.driverId)} · ${l.loadQtyL}L${l.shipmentNo ? ` · ship ${l.shipmentNo}` : ""}${l.shipmentLead && l.shipmentOilLiters ? ` · oil ${l.shipmentOilLiters}L` : ""}`}
                    right={l.shortageL ? `${l.shortageL}L` : ""} rightTone={l.shortageL ? "red" : null} />)}
              </View>
            )}

            {tab === "shortages" && (
              <View style={{ marginTop: S.md }}>
                <Text style={s.rowMeta}>Depot shortages often arrive 15–45 days late. Each is tracked as Pending (not yet cut) or Deducted (and which month's payslip).</Text>
                <View style={{ height: S.md }} />
                {shortages.length === 0 ? <EmptyState icon="check-circle-outline" text="No shortages" /> :
                  shortages.map((x) => {
                    const st = x.status === "open" ? "Pending" : x.status === "deducted" ? `Deducted · ${monthShort(x.deductedPeriod)}${x.deductedPaid ? " (paid)" : ""}` : "Waived";
                    return <ListRow key={x.id} icon="alert" title={`${x.invoiceNumber} · ${driverName(x.driverId)}`}
                      meta={`${x.shortageL}L · ${st}`} right={rupee(x.shortageValue)} rightTone={x.status === "deducted" ? "green" : "red"} />;
                  })}
              </View>
            )}

            {tab === "meterReadings" && (
              <View style={{ marginTop: S.md }}>
                <AppButton title="Add meter reading" icon="gauge" onPress={() => setModal("meter")} />
                <Text style={[s.rowMeta, { marginTop: S.md }]}>Odometer readings drivers recorded on their trips. Tap a row with a photo to view it.</Text>
                <View style={{ height: S.md }} />
                {meterReadings.length === 0 ? <EmptyState icon="gauge-empty" text="No meter readings yet" /> :
                  meterReadings.map((r) => {
                    const inv = (loads.find((l) => l.id === r.loadId)?.invoiceNumber) || "trip";
                    return (
                      <TouchableOpacity key={r.id} activeOpacity={r.hasPhoto ? 0.7 : 1}
                        onPress={() => r.hasPhoto && setModal({ photo: r.id })}>
                        <ListRow icon="gauge" title={`${r.readingKm.toLocaleString("en-IN")} km`}
                          meta={`${driverName(r.driverId)} · ${inv} · ${new Date(r.recordedAt).toLocaleDateString("en-IN")} · ${r.source}${r.notes ? ` · ${r.notes}` : ""}`}
                          right={r.hasPhoto ? "📷" : ""} />
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}

            {tab === "drivers" && (
              <View style={{ marginTop: S.md }}>
                <AppButton title="Add driver" icon="account-plus" onPress={() => setModal("driver")} />
                <Text style={[s.rowMeta, { marginTop: S.md }]}>Tap a driver to allow or block app/web login.</Text>
                <View style={{ height: S.md }} />
                {drivers.length === 0 ? <EmptyState icon="account-group-outline" text="No drivers" /> :
                  drivers.map((d) => (
                    <TouchableOpacity key={d.id} activeOpacity={0.7} onPress={() => toggleDriverAccess(d)}>
                      <ListRow icon="account" title={d.name}
                        meta={`${d.phone} · base ${rupee(d.baseSalary)} · login ${d.appAccessEnabled ? "ON" : "off"}`}
                        right={d.appAccessEnabled ? "Login ✓" : "Login off"} rightTone={d.appAccessEnabled ? "green" : null} />
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            {tab === "trucks" && (
              <View style={{ marginTop: S.md }}>
                <AppButton title="Add truck" icon="truck-plus" onPress={() => setModal("truck")} />
                <View style={{ height: S.md }} />
                {trucks.length === 0 ? <EmptyState icon="dump-truck" text="No trucks" /> :
                  trucks.map((tr) => <ListRow key={tr.id} icon="truck" title={tr.name || tr.registrationNo} meta={`${tr.type} · ${tr.averageKmL} km/L`} right={driverName(tr.assignedDriverId)} />)}
              </View>
            )}

            {tab === "ledger" && (
              <View style={{ marginTop: S.md }}>
                <Text style={s.rowMeta}>Deliveries are grouped by Shipment No. When a shipment drops at several pumps, diesel is given for the farthest pump only (longest RTKM ÷ tanker avg).</Text>
                <View style={{ height: S.md }} />
                <ReconCard summary={ledger.summary} />
                <View style={[s.tiles]}>
                  <Tile label="Freight charged" value={rupee(ledger.summary?.totalFreight)} icon="cash-multiple" tone="indigo" />
                  <Tile label="Received" value={rupee(ledger.summary?.totalReceived)} icon="bank" tone="green" />
                  <Tile label="Diesel given" value={`${Math.round(ledger.summary?.totalOil || 0)} L`} icon="fuel" tone="blue" />
                  <Tile label="Shortage cut" value={rupee(ledger.summary?.totalDeduction)} icon="trending-down" tone="rose" />
                </View>
                {(() => {
                  const pend = [...new Set((ledger.loads || []).filter((l) => !l.hasInvoice).map((l) => l.invoiceNumber).filter(Boolean))];
                  return pend.length > 0 ? (
                    <View style={{ marginTop: S.md, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 12 }}>
                      <Text style={{ color: "#b45309", fontWeight: "700" }}>⚠ {pend.length} deliveries missing their Invoice</Text>
                      <Text style={{ color: "#92400e", fontSize: 12, marginTop: 4 }}>Saved but marked “invoice pending” — upload the Tax Invoice for: {pend.join(", ")}.</Text>
                    </View>
                  ) : null;
                })()}
                <View style={{ height: S.md }} />
                {(ledger.loads || []).length === 0 ? <EmptyState icon="clipboard-list-outline" text="No deliveries. Upload a Statement of Freight." /> :
                  groupByShipment(ledger.loads, extraOil).map((g) => {
                    const ft = (ledger.fastagByShipment || {})[g.shipmentNo || `solo:${g.loads[0].id}`];
                    return (
                    <View key={g.shipmentNo || g.loads[0].id} style={s.shipCard}>
                      <View style={s.shipHead}>
                        <MaterialCommunityIcons name="truck-fast" size={15} color="#4338ca" />
                        <Text style={s.shipTitle}>{g.shipmentNo ? `Shipment ${g.shipmentNo}` : "Single load"}</Text>
                        <Text style={s.shipMeta}>{g.pumps} pump{g.pumps > 1 ? "s" : ""} · {g.cargo.toLocaleString("en-IN")}L</Text>
                        <View style={{ flex: 1 }} />
                        {ft && ft.toll > 0 && (
                          <TouchableOpacity onPress={() => Alert.alert(`FASTag tolls · ${rupee(ft.toll)}`, `${ft.count} pass${ft.count === 1 ? "" : "es"} matched to this trip by date:\n\n` + (ft.items || []).map((it) => `${fmtDay(it.date)} · ${it.plaza} · ${rupee(it.amount)}`).join("\n"))} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
                            <MaterialCommunityIcons name="boom-gate" size={14} color="#7c3aed" />
                            <Text style={[s.shipOil, { color: "#7c3aed" }]}>{rupee(ft.toll)}</Text>
                          </TouchableOpacity>
                        )}
                        <MaterialCommunityIcons name="fuel" size={14} color="#2563eb" />
                        <Text style={s.shipOil}>{g.oil}{g.extraL > 0 ? `+${g.extraL}` : ""} L · {rupee(g.oilCost + g.extraCost)}</Text>
                      </View>
                      <Text style={s.shipSub}>
                        {g.pumps > 1 ? `Farthest ${g.maxRtkm} km · freight ${rupee(g.freight)} · ` : ""}
                        <Text style={{ fontWeight: "800", color: "#e11d48" }}>spend {rupee(g.oilCost + g.extraCost + g.meal + (ft?.toll || 0))}</Text>
                        {g.meal > 0 ? ` (incl. ${rupee(g.meal)} meal)` : ""}
                      </Text>
                      {g.loads.map((l) => <LedgerRow key={l.id} l={l} />)}
                      {g.extraEntries.map((e) => (
                        <TouchableOpacity key={e.id} onPress={() => removeExtraOil(e)} activeOpacity={0.7} style={s.extraRow}>
                          <MaterialCommunityIcons name="fuel" size={14} color="#e11d48" />
                          <Text style={s.extraText}>+{e.litres}L extra · {reasonLabel(e.reason)}{e.notes ? ` · ${e.notes}` : ""}</Text>
                          <View style={{ flex: 1 }} />
                          <MaterialCommunityIcons name="trash-can-outline" size={15} color="#e11d48" />
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={s.extraAdd} onPress={() => setExtraGroup(g)} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="plus" size={15} color="#2563eb" />
                        <Text style={s.extraAddText}>Add extra oil</Text>
                      </TouchableOpacity>
                    </View>
                  ); })}
              </View>
            )}

            {tab === "uploads" && (
              <View style={{ marginTop: S.md }}>
                <Text style={s.rowMeta}>Every PDF you upload is listed here. Tap Undo to revert exactly what that upload changed.</Text>
                <View style={{ height: S.md }} />
                {uploads.length === 0 ? <EmptyState icon="history" text="No uploads yet." /> :
                  uploads.map((u) => {
                    const k = UPLOAD_KIND[u.kind] || { label: u.kind || "Upload", icon: "file-document" };
                    return (
                      <TouchableOpacity key={u.id} onPress={() => undoUpload(u)} activeOpacity={u.reverted ? 1 : 0.7}>
                        <ListRow icon={k.icon} title={`${k.label}${u.reverted ? " · reverted" : ""}`}
                          meta={`${new Date(u.createdAt).toLocaleString("en-IN")}${u.summary ? ` · ${u.summary}` : ""}${u.reverted ? "" : " · tap to undo"}`}
                          right={u.reverted ? "reverted" : "active"} rightTone={u.reverted ? null : "green"} />
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}

            {tab === "maintenance" && (
              <View style={{ marginTop: S.md }}>
                <AppButton title="Add record" icon="wrench" onPress={() => setModal("maintenance")} />
                <View style={{ height: S.md }} />
                {maintenance.length === 0 ? <EmptyState icon="wrench-outline" text="No maintenance records" /> :
                  maintenance.map((m) => <ListRow key={m.id} icon="wrench" title={m.category || "Service"} meta={`${truckName(m.truckId)} · ${new Date(m.date).toLocaleDateString("en-IN")}`} right={rupee(m.cost)} />)}
              </View>
            )}

            {tab === "fastag" && (
              <View style={{ marginTop: S.md }}>
                <Text style={s.rowMeta}>Upload BlackBuck BOSS wallet + each tanker statement. Tolls are the truth; the wallet is checked for extra/non-toll charges.</Text>
                <View style={{ height: S.md }} />
                <AppButton title={fastagBusy ? "Reading…" : "Upload FASTag PDFs"} icon="upload" onPress={pickFastag} loading={fastagBusy} />
                {(fastag.months || []).length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, marginTop: S.md }}>
                    <Chip label="All time" active={!fastagPeriod} onPress={() => setFastagPeriod("")} />
                    {fastag.months.map((m) => <Chip key={m} label={monthShort(m)} active={m === fastagPeriod} onPress={() => setFastagPeriod(m)} />)}
                  </ScrollView>
                )}
                <View style={[s.tiles, { marginTop: S.md }]}>
                  <Tile label="Tolls paid" value={rupee(fastag.totals?.totalToll)} icon="boom-gate" tone="indigo" />
                  <Tile label="Non-toll charges" value={rupee(fastag.totals?.extras)} icon="alert" tone={(fastag.totals?.extras || 0) > 0 ? "rose" : "green"} />
                  <Tile label="FASTag cost" value={rupee(fastag.totals?.fastagCost)} icon="trending-down" tone="amber" />
                  <Tile label="Top-ups" value={rupee(fastag.totals?.topup)} icon="bank" tone="green" />
                </View>
                {(fastag.flags || []).length > 0 && (
                  <View style={{ marginTop: S.md, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 12 }}>
                    <Text style={{ color: "#b45309", fontWeight: "700" }}>⚠ Review ({fastag.flags.length})</Text>
                    {fastag.flags.map((f, i) => <Text key={i} style={{ color: "#92400e", fontSize: 12, marginTop: 4 }}>{f.vehicleNo ? f.vehicleNo + ": " : ""}{f.msg}</Text>)}
                  </View>
                )}
                {(fastag.charges || []).filter((c) => c.reviewStatus !== "expected").length > 0 && (
                  <>
                    <Text style={[s.section, { marginTop: S.lg }]}>Non-toll charges (tap to review)</Text>
                    {fastag.charges.filter((c) => c.reviewStatus !== "expected").map((c) => (
                      <TouchableOpacity key={c.id} onPress={() => reviewCharge(c)} activeOpacity={0.7}>
                        <ListRow icon={c.reviewStatus === "disputed" ? "alert-octagon" : "help-circle"}
                          title={`${c.desc} · ${rupee(c.amount)}`}
                          meta={`Txn ${c.txnId || "—"}${c.reviewStatus === "disputed" ? " · DISPUTED" : " · tap: expected/dispute"}`}
                          right={c.reviewStatus === "disputed" ? "disputed" : "review"} rightTone="red" />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {!fastagPeriod && (fastag.byMonth || []).length > 0 && (
                  <>
                    <Text style={[s.section, { marginTop: S.lg }]}>Month by month (tap to open)</Text>
                    {fastag.byMonth.map((m) => (
                      <TouchableOpacity key={m.period} onPress={() => setFastagPeriod(m.period)} activeOpacity={0.7}>
                        <ListRow icon="calendar-month" title={monthShort(m.period)}
                          meta={`${m.count} passes · non-toll ${rupee(m.nonToll)} · top-up ${rupee(m.topup)}`}
                          right={rupee(m.cost)} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                <Text style={[s.section, { marginTop: S.lg }]}>Tolls by tanker{fastagPeriod ? ` · ${monthShort(fastagPeriod)}` : ""}</Text>
                {(fastag.byTruck || []).length === 0 ? <Text style={s.rowMeta}>No FASTag data yet.</Text> :
                  fastag.byTruck.map((r) => (
                    <ListRow key={r.vehicleNo} icon="boom-gate" title={r.vehicleNo}
                      meta={`${r.tollCount} toll passes`} right={rupee(r.toll)} />
                  ))}
                {(fastag.topPlazas || []).length > 0 && <Text style={[s.section, { marginTop: S.lg }]}>Top plazas</Text>}
                {(fastag.topPlazas || []).map((p, i) => <ListRow key={i} icon="map-marker" title={p.plaza} meta={`${p.count} passes`} right={rupee(p.amount)} />)}

                {(fastag.tolls || []).length > 0 && (
                  <>
                    <Text style={[s.section, { marginTop: S.lg }]}>Toll transactions ({fastag.tolls.length})</Text>
                    {fastag.tolls.slice(0, 100).map((tx) => (
                      <ListRow key={tx.id} icon="boom-gate" title={`${tx.vehicleNo || "—"} · ${rupee(tx.amount)}`}
                        meta={`${fmtDay(tx.date)} · ${tx.plaza || "—"}`} />
                    ))}
                  </>
                )}
              </View>
            )}

            {tab === "gatein" && (
              <View style={{ marginTop: S.md }}>
                <Text style={s.rowMeta}>Every time a tanker enters a depot, the oil company emails a "Gate In" notice. Sync pulls those from your connected Gmail.</Text>
                <AppButton title={gateInBusy ? "Syncing…" : "Sync from Gmail"} icon="email-sync-outline" onPress={syncGate} loading={gateInBusy} style={{ marginTop: 10 }} />
                <View style={{ flexDirection: "row", gap: 8, marginTop: S.md }}>
                  <Tile label="Gate-in events" value={gateIn.total || 0} icon="warehouse" tone="blue" />
                  <Tile label="Depots" value={(gateIn.byDepot || []).length} icon="warehouse" tone="green" />
                </View>
                <Text style={[s.section, { marginTop: S.lg }]}>Gate events</Text>
                {(gateIn.rows || []).length === 0 ? <Text style={s.rowMeta}>No gate events yet — tap "Sync from Gmail".</Text> :
                  gateIn.rows.map((r) => (
                    <ListRow key={r.id} icon={r.direction === "out" ? "logout" : "login"}
                      title={`${r.vehicleNo || "—"} · ${r.depot || "—"}`}
                      meta={`${r.gateAt ? new Date(r.gateAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}${r.company ? " · " + r.company : ""}`}
                      right={r.direction === "out" ? "Gate Out" : "Gate In"} rightTone={r.direction === "out" ? "amber" : "green"} />
                  ))}
              </View>
            )}

            {tab === "alerts" && (
              <View style={{ marginTop: S.md }}>
                <Text style={s.rowMeta}>Depot mails warn you before a tanker's document (permit / fitness / insurance) expires, or it gets blocked for loading. Sync pulls these from Gmail; you also get a phone push when one arrives.</Text>
                <AppButton title={alertsBusy ? "Syncing…" : "Sync from Gmail"} icon="email-sync-outline" onPress={syncAlerts} loading={alertsBusy} style={{ marginTop: 10 }} />
                <Text style={[s.section, { marginTop: S.lg }]}>Document expiries</Text>
                {(alerts.rows || []).length === 0 ? <Text style={s.rowMeta}>No alerts yet — tap "Sync from Gmail".</Text> :
                  alerts.rows.map((r) => {
                    const n = r.expiryDate ? Math.ceil((new Date(r.expiryDate).getTime() - Date.now()) / 86400000) : null;
                    const status = n == null ? "—" : n < 0 ? `expired ${Math.abs(n)}d` : `${n}d left`;
                    const tone = n == null ? undefined : n < 0 ? "red" : n <= 15 ? "amber" : "green";
                    return (
                      <ListRow key={r.id} icon="file-certificate"
                        title={`${r.vehicleNo || "—"} · ${r.certificate || ""}`}
                        meta={`Expires ${r.expiryDate ? new Date(r.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}`}
                        right={status} rightTone={tone} />
                    );
                  })}
              </View>
            )}

            {tab === "salaries" && (
              <View style={{ marginTop: S.md }}>
                {user.role === "owner" && <AppButton title="Generate payslip" icon="cash-plus" onPress={() => setModal("salary")} />}
                <View style={{ height: S.md }} />
                {salaries.length === 0 ? <EmptyState icon="cash-multiple" text="No payslips" /> :
                  salaries.map((p) => (
                    <TouchableOpacity key={p.id} onPress={() => markPaid(p)} activeOpacity={0.7}>
                      <ListRow icon="cash" title={`${driverName(p.driverId)} · ${p.period}`}
                        meta={`base ${rupee(p.baseSalary)}${p.daysInMonth ? ` (${p.payableDays}/${p.daysInMonth}d${p.leaveDays ? `, ${p.leaveDays} leave` : ""})` : ""} − cuts ${rupee(p.deductions.reduce((a, d) => a + d.amount, 0))} · tap for details`}
                        right={rupee(p.netPay)} rightTone={p.status === "paid" ? "green" : null} />
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            {tab === "reports" && (
              <View style={{ marginTop: S.md }}>
                <Text style={s.section}>Settlement — charged vs received</Text>
                <View style={s.tiles}>
                  <Tile label="Should settle" value={rupee(ledger.summary?.totalFreight)} icon="cash-multiple" tone="indigo" />
                  <Tile label="Received" value={rupee(ledger.summary?.totalReceived)} icon="bank" tone="green" />
                  <Tile label="Pending" value={rupee(ledger.summary?.pendingFreight)} icon="clock-outline" tone="amber" />
                  <Tile label="Shortage cut" value={rupee(ledger.summary?.totalDeduction)} icon="trending-down" tone="rose" />
                </View>

                <Text style={s.section}>Short-paid deliveries (received less)</Text>
                {(() => {
                  const sp = (ledger.loads || []).filter((l) => (l.nayaraShortageDeduction || 0) + (l.otherDeduction || 0) > 0);
                  return sp.length === 0 ? <Text style={s.rowMeta}>None 🎉</Text> :
                    sp.map((l) => <ListRow key={l.id} icon="alert" title={l.invoiceNumber} meta={`charged ${rupee(l.freightAmount)} · cut ${rupee((l.nayaraShortageDeduction || 0) + (l.otherDeduction || 0))}`} right={rupee(l.netReceived)} rightTone="red" />);
                })()}

                <Text style={s.section}>Monthly profitability</Text>
                <Text style={s.rowMeta}>Received in bank − (diesel + extra oil + maintenance + salaries).</Text>
                <View style={[s.tiles, { marginTop: 8 }]}>
                  <Tile label="Received" value={rupee(profit.totals?.received)} icon="bank" tone="green" />
                  <Tile label="Costs" value={rupee(profit.totals?.costs)} icon="trending-down" tone="amber" />
                  <Tile label="Profit" value={rupee(profit.totals?.profit)} icon="cash-multiple" tone={(profit.totals?.profit || 0) >= 0 ? "indigo" : "rose"} />
                </View>
                <View style={{ height: 8 }} />
                {(profit.rows || []).length === 0 ? <Text style={s.rowMeta}>No data yet.</Text> :
                  profit.rows.map((r) => <ListRow key={r.month} icon="calendar-month" title={`${monthShort(r.month)} · profit ${rupee(r.profit)}`} meta={`recd ${rupee(r.received)} · diesel ${rupee(r.fuel)} · tolls ${rupee(r.fastag)} · meal ${rupee(r.mealAllowance)}`} right={rupee(r.profit)} rightTone={r.profit >= 0 ? "green" : "red"} />)}

                <Text style={s.section}>Driver shortage (by month)</Text>
                {(driverShortage.rows || []).length === 0 ? <Text style={s.rowMeta}>No shortages recorded.</Text> :
                  driverShortage.rows.map((r, i) => <ListRow key={i} icon="account-alert" title={`${r.driverName} · ${r.period}`} meta={`${r.shortageL} L · ${r.trips} trip(s)`} right={rupee(r.shortageValue)} rightTone="red" />)}

                <Text style={s.section}>Extra oil — who asks most (driver)</Text>
                {(extraReport.byDriver || []).length === 0 ? <Text style={s.rowMeta}>No extra-oil entries.</Text> :
                  extraReport.byDriver.map((r, i) => <ListRow key={i} icon="account-alert" title={r.label} meta={`${r.times} time(s) · ${Math.round(r.totalL)} L`} right={r.totalCost ? rupee(r.totalCost) : `${Math.round(r.totalL)}L`} rightTone="red" />)}

                <Text style={s.section}>Extra oil — by tanker</Text>
                {(extraReport.byTruck || []).length === 0 ? <Text style={s.rowMeta}>No extra-oil entries.</Text> :
                  extraReport.byTruck.map((r, i) => <ListRow key={i} icon="truck" title={r.label} meta={`${r.times} time(s) · ${Math.round(r.totalL)} L`} right={r.totalCost ? rupee(r.totalCost) : `${Math.round(r.totalL)}L`} rightTone="red" />)}
              </View>
            )}

            {tab === "managers" && (
              <View style={{ marginTop: S.md }}>
                {user.role === "owner" && <AppButton title="Add manager" icon="account-plus" onPress={() => setModal("manager")} />}
                <View style={{ height: S.md }} />
                {managers.length === 0 ? <EmptyState icon="account-tie-outline" text="No managers" /> :
                  managers.map((m) => <ListRow key={m.id} icon="account-tie" title={m.name} meta={m.phone} right={m.status} rightTone={m.status === "active" ? "green" : "red"} />)}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {modal === "invoice" && <UploadModal kind="invoice" transportId={tid} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "shortage" && <UploadModal kind="shortage" transportId={tid} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {tid && (
        <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={() => setModal("ledgerAuto")}>
          <MaterialCommunityIcons name="cloud-upload" size={22} color="#fff" />
          <Text style={s.fabText}>Upload</Text>
        </TouchableOpacity>
      )}
      {modal === "ledgerAuto" && <LedgerUploadModal transportId={tid} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "ledgerFreight" && <LedgerUploadModal transportId={tid} expect="freight" onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "ledgerBank" && <LedgerUploadModal transportId={tid} expect="payment" onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "driver" && <AddDriverModal transportId={tid} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "truck" && <AddTruckModal transportId={tid} drivers={drivers} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "maintenance" && <AddMaintenanceModal transportId={tid} trucks={trucks} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {extraGroup && <ExtraOilModal group={extraGroup} transportId={tid} onClose={() => setExtraGroup(null)} onDone={() => { setExtraGroup(null); refresh(); }} />}
      {notifOpen && <NotificationsModal items={notifs.notifications} onClose={() => setNotifOpen(false)} />}
      {modal === "manager" && <AddManagerModal transportId={tid} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "salary" && <GenerateSalaryModal transportId={tid} drivers={drivers} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "meter" && (
        <MeterReadingModal title="Add meter reading" loads={loads} drivers={drivers}
          onSubmit={(fields, asset) => submitMeterReading({ ...fields, transportId: tid }, asset)}
          onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />
      )}
      {modal?.photo && <MeterPhotoModal readingId={modal.photo} onClose={() => setModal(null)} />}
    </ScreenBg>
  );
}

// Full-screen view of a meter photo. Image is auth-protected, so we pass the bearer token as a header.
function MeterPhotoModal({ readingId, onClose }) {
  const [uri, setUri] = useState(null);
  const [headers, setHeaders] = useState({});
  useEffect(() => {
    (async () => {
      const base = await getServerUrl();
      const token = await getToken();
      setUri(`${base}/api/meter-readings/${readingId}/photo`);
      setHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    })();
  }, [readingId]);
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" }} activeOpacity={1} onPress={onClose}>
        {uri ? <Image source={{ uri, headers }} style={{ width: "92%", height: "70%" }} resizeMode="contain" /> : null}
        <Text style={{ color: "#fff", marginTop: 16 }}>Tap anywhere to close</Text>
      </TouchableOpacity>
    </Modal>
  );
}

// ---------------- Upload modal ----------------
function Sheet({ title, children, onClose }) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBg}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Progress + summary for an auto-import batch (multiple PDFs picked at once).
function BatchList({ batch, onDone }) {
  const done = batch.results.length;
  const finished = done >= batch.total;
  const count = (st) => batch.results.filter((r) => r.status === st).length;
  const color = { added: C.teal, duplicate: C.amber, needsinvoice: C.amber, failed: C.red };
  const icon = { added: "check-circle", duplicate: "alert-circle", needsinvoice: "file-alert", failed: "close-circle" };
  return (
    <>
      <Text style={s.uploadHint}>{finished ? "All documents processed." : `Reading ${done + 1} of ${batch.total}…`}</Text>
      <View style={{ marginVertical: 10 }}>
        {batch.results.map((r, i) => (
          <View key={i} style={s.row}>
            <MaterialCommunityIcons name={icon[r.status]} size={20} color={color[r.status]} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, color: C.ink }} numberOfLines={1}>{r.name}</Text>
            <Text style={{ color: color[r.status], fontWeight: "700", fontSize: 12 }}>{r.status}</Text>
          </View>
        ))}
        {!finished && <Text style={s.uploadHint}>Reading {done + 1} of {batch.total}…</Text>}
      </View>
      {finished && (
        <>
          <Text style={{ fontWeight: "700", color: C.ink, marginBottom: 10 }}>{count("added")} added · {count("duplicate")} duplicate · {count("needsinvoice")} need invoice · {count("failed")} failed</Text>
          <AppButton title="Done" icon="check" onPress={onDone} />
        </>
      )}
    </>
  );
}

function UploadModal({ kind, transportId, onClose, onDone }) {
  const [source, setSource] = useState("file");
  const [step, setStep] = useState("pick");
  const [busy, setBusy] = useState(false);
  const [uploadId, setUploadId] = useState(null);
  const [dup, setDup] = useState(false);
  const [batch, setBatch] = useState(null);
  const [f, setF] = useState({});
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const [emailState, setEmailState] = useState("idle"); // idle|checking|disconnected|scanning|importing
  const [messages, setMessages] = useState([]);
  const [allBusy, setAllBusy] = useState(false); // bulk "import all from email" in progress
  const [ship, setShip] = useState(null); // shipment summary for the "diesel for this trip" acknowledgement

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: true });
      if (res.canceled) return;
      const assets = res.assets || [];
      if (assets.length > 1) { await runBatch(assets); return; }
      setBusy(true);
      const up = kind === "invoice" ? await uploadInvoice(assets[0], transportId) : await uploadShortage(assets[0], transportId);
      if (kind === "shortage" && up.delivery) {
        Alert.alert("Delivery statement", `${up.duplicate ? "(already uploaded) " : ""}${up.created} new + ${up.updated} updated deliveries mapped, ${up.shortagesCreated} shortage(s) recorded.`);
        onDone(); return;
      }
      setUploadId(up.uploadId); setDup(!!up.duplicate); setF(up.draft || {}); setStep("review");
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  // Auto-import many PDFs at once: process + save each, collect a per-file result.
  async function runBatch(assets) {
    setStep("batch");
    const results = [];
    setBatch({ total: assets.length, results: [] });
    for (const a of assets) {
      let status = "added";
      try {
        if (kind === "invoice") {
          const up = await uploadInvoice(a, transportId);
          await confirmInvoice({ transportId, uploadId: up.uploadId, ...(up.draft || {}), averageKmL: 4 });
          if (up.duplicate) status = "duplicate";
        } else {
          const up = await uploadShortage(a, transportId);
          if (!up.delivery) {
            await confirmShortage({ transportId, uploadId: up.uploadId, ...(up.draft || {}) });
            if (up.duplicate) status = "duplicate";
          } // delivery statements are processed server-side on upload
        }
      } catch { status = "failed"; }
      results.push({ name: a.name, status });
      setBatch({ total: assets.length, results: [...results] });
    }
  }
  async function chooseEmail() {
    setSource("email"); setEmailState("checking");
    try { const g = await gmailStatus(transportId); setEmailState(g?.connected ? "idle" : "disconnected"); }
    catch { setEmailState("disconnected"); }
  }
  async function scan() {
    setEmailState("scanning");
    try { setMessages(await gmailMessages(transportId)); } catch (e) { Alert.alert("Error", String(e.message || e)); }
    finally { setEmailState("idle"); }
  }
  async function importMsg(m) {
    setEmailState("importing");
    try { const r = await gmailImport({ transportId, kind, messageId: m.messageId, attachmentId: m.attachmentId, filename: m.filename }); setUploadId(r.uploadId); setF(r.draft || {}); setStep("review"); }
    catch (e) { Alert.alert("Error", String(e.message || e)); setEmailState("idle"); }
  }
  // Bulk: scan + auto-file every statement from saved sender domains (configured on web).
  async function importAllEmail() {
    setAllBusy(true);
    try {
      const r = await gmailImportAll(transportId);
      const c = r.counts || {};
      const lines = [
        ["Invoices", c.invoice], ["Freight statements", c.freight], ["Payments", c.payment], ["FASTag", c.fastag],
        ["Duplicates skipped", c.duplicates], ["Unrecognised", c.unrecognised], ["Failed", c.failed],
      ].filter(([, n]) => n > 0).map(([l, n]) => `${l}: ${n}`).join("\n");
      Alert.alert(`Scanned ${r.scanned} · imported ${r.imported}`, lines || "Nothing new to import.", [{ text: "OK", onPress: onDone }]);
    } catch (e) { Alert.alert("Error", String(e.message || e)); }
    finally { setAllBusy(false); }
  }
  async function confirm() {
    setBusy(true);
    try {
      if (kind === "invoice") {
        const r = await confirmInvoice({ transportId, uploadId, ...f });
        // Show the diesel-for-this-trip acknowledgement instead of a bare alert.
        if (r?.shipment) { setShip(r.shipment); setStep("ack"); return; }
        Alert.alert("✓", "Load saved."); onDone(); return;
      }
      const r = await confirmShortage({ transportId, uploadId, ...f });
      Alert.alert("✓", `Shortage recorded. Deduction ${rupee(r.mappedTo?.deduction)}.`);
      onDone();
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }

  const fields = kind === "invoice"
    ? [["roName", "Pump name", "gas-station"], ["pumpCode", "Pump ID", "barcode"], ["address", "Pump address", "map-marker"],
       ["invoiceNumber", "Invoice number", "receipt"], ["fromLocation", "Depot / from", "domain"], ["truckReg", "Vehicle / tanker", "truck"],
       ["loadQtyL", "Volume (L)", "fuel"], ["product", "Product code", "tag"], ["shipmentNo", "Shipment no", "barcode-scan"],
       ["rtkm", "RTKM (auto from DB)", "map-marker-distance"]]
    : [["invoiceNumber", "Invoice number", "receipt"], ["shortageL", "Shortage (L)", "fuel"]];

  return (
    <Sheet title={kind === "invoice" ? "Add invoice" : "Add shortage / delivery statement"} onClose={onClose}>
      {step === "pick" ? (
        <>
          <View style={s.segment}>
            <TouchableOpacity style={[s.segBtn, source === "file" && s.segBtnActive]} onPress={() => setSource("file")}>
              <Text style={source === "file" ? s.segTextActive : s.segText}>Upload file</Text></TouchableOpacity>
            <TouchableOpacity style={[s.segBtn, source === "email" && s.segBtnActive]} onPress={chooseEmail}>
              <Text style={source === "email" ? s.segTextActive : s.segText}>From email</Text></TouchableOpacity>
          </View>

          {source === "file" ? (
            <>
              <View style={s.uploadBox}>
                <MaterialCommunityIcons name="file-pdf-box" size={48} color={C.red} />
                <Text style={s.uploadHint}>{kind === "shortage"
                  ? "Pick a single shortage report, or the full Delivery / Freight Statement — we map each row to its invoice."
                  : "Pick the company PDF — we read it and you confirm the details."}</Text>
                <Text style={[s.uploadHint, { marginTop: 4, fontWeight: "700", color: C.green }]}>Select multiple PDFs to import them all at once.</Text>
              </View>
              <AppButton title="Choose PDF(s)" icon="file-search" onPress={pickFile} loading={busy} />
            </>
          ) : (
            <>
              {emailState === "checking" && <Text style={s.uploadHint}>Checking Gmail…</Text>}
              {emailState === "disconnected" ? (
                <View style={{ backgroundColor: C.amberLight, padding: 14, borderRadius: R.md }}>
                  <Text style={{ color: "#92400e" }}>Gmail isn't connected for this transport. Connect it once on the web dashboard (Settings → Connect Gmail), then scan here.</Text>
                </View>
              ) : emailState !== "checking" ? (
                <>
                  <AppButton title={allBusy ? "Importing all… keep open" : "Import all (auto-file)"} icon="email-sync-outline" onPress={importAllEmail} loading={allBusy} />
                  <Text style={[s.uploadHint, { marginTop: 4 }]}>Auto-files every statement from your saved senders (set the sender domains on the web dashboard). Duplicates are skipped.</Text>
                  <View style={{ height: 10 }} />
                  <AppButton title={emailState === "scanning" ? "Scanning…" : "Or scan & pick one"} icon="email-search-outline" variant="light" onPress={scan} loading={emailState === "scanning"} />
                  <View style={{ height: 8 }} />
                  {messages.map((m) => (
                    <TouchableOpacity key={m.messageId + m.attachmentId} style={s.row} onPress={() => importMsg(m)} disabled={emailState === "importing"}>
                      <View style={s.rowIcon}><MaterialCommunityIcons name="file-pdf-box" size={20} color={C.red} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>{m.filename}</Text>
                        <Text style={s.rowMeta} numberOfLines={1}>{m.from}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {emailState === "importing" && <Text style={s.uploadHint}>Reading attachment…</Text>}
                </>
              ) : null}
            </>
          )}
          <CancelBtn onClose={onClose} />
        </>
      ) : step === "batch" ? (
        <BatchList batch={batch} onDone={onDone} />
      ) : step === "ack" ? (
        <InvoiceAck shipment={ship} transportId={transportId} onDone={onDone} />
      ) : (
        <>
          {dup && <Text style={{ color: "#92400e", marginBottom: 8 }}>⚠️ This PDF was already uploaded earlier — saving updates the existing record.</Text>}
          {fields.map(([k, lbl, ic]) => (
            <LInput key={k} icon={ic} placeholder={lbl} value={String(f[k] || "")} onChangeText={set(k)}
              keyboardType={["loadQtyL", "shortageL", "rtkm"].includes(k) ? "numeric" : "default"} />
          ))}
          <AppButton title={busy ? "Saving…" : "Save"} icon="content-save" onPress={confirm} loading={busy} />
          <CancelBtn onClose={onClose} />
        </>
      )}
    </Sheet>
  );
}

// Acknowledgement after an invoice is saved: the whole shipment's total vs longest (farthest) RTKM
// and the diesel the driver should get for the trip. The oil price is editable here and, when saved,
// becomes the global diesel price used across every load, the ledger and all reports.
function InvoiceAck({ shipment, transportId, onDone }) {
  const [price, setPrice] = useState(String(shipment?.dieselPrice ?? 0));
  const [baseline, setBaseline] = useState(Number(shipment?.dieselPrice) || 0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [meal, setMeal] = useState(String(shipment?.mealAllowance ?? 0));
  const [mealBase, setMealBase] = useState(Number(shipment?.mealAllowance) || 0);
  const [mealBusy, setMealBusy] = useState(false);
  const p = Number(price) || 0;
  const liters = shipment?.dieselLiters || 0;
  const amount = Math.round(liters * p);
  const dirty = p !== baseline;
  const mealVal = Number(meal) || 0;
  const mealDirty = mealVal !== mealBase;
  const giveTotal = amount + mealVal;

  async function savePrice() {
    setBusy(true);
    try { await updateTransport(transportId, { dieselPrice: p }); setBaseline(p); setSaved(true); }
    catch (e) { Alert.alert("Error", String(e.message || e)); }
    finally { setBusy(false); }
  }
  async function saveMeal() {
    if (!shipment?.loadId) return;
    setMealBusy(true);
    try { await setMealAllowance(shipment.loadId, mealVal); setMealBase(mealVal); }
    catch (e) { Alert.alert("Error", String(e.message || e)); }
    finally { setMealBusy(false); }
  }

  const Stat = ({ label, value, accent }) => (
    <View style={s.ackStat}>
      <Text style={s.ackStatLabel}>{label}</Text>
      <Text style={[s.ackStatValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <MaterialCommunityIcons name="fuel" size={20} color={C.green} />
        <Text style={{ fontSize: 16, fontWeight: "800", color: C.green }}>Diesel for this trip</Text>
      </View>
      <Text style={s.uploadHint}>
        {shipment?.shipmentNo
          ? `Shipment ${shipment.shipmentNo} · ${shipment.loadCount} drop${shipment.loadCount === 1 ? "" : "s"} clubbed — oil is given once, for the farthest pump.`
          : "Single delivery (no shipment number)."}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
        <Stat label="Total RTKM" value={`${shipment?.totalRtkm || 0} km`} />
        <Stat label="Longest RTKM" value={`${shipment?.maxRtkm || 0} km`} accent={C.green} />
        <Stat label="Tanker average" value={`${shipment?.tankerAvg} km/L`} />
        <Stat label="Diesel to give" value={`${liters} L`} accent={C.teal} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
        <Text style={{ fontSize: 14, color: C.sub }}>Oil price</Text>
        <View style={{ width: 100 }}>
          <LInput icon="currency-inr" placeholder="₹ / L" keyboardType="numeric"
            value={price} onChangeText={(v) => { setPrice(v); setSaved(false); }} />
        </View>
        <Text style={{ fontSize: 14, color: C.sub }}>₹ / L</Text>
      </View>
      <AppButton title={busy ? "Saving…" : dirty ? "Save price" : saved ? "Saved ✓" : "Saved"}
        icon="content-save" variant="light" onPress={savePrice} loading={busy} disabled={!dirty} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
        <Text style={{ fontSize: 14, color: C.sub }}>Meal allowance</Text>
        <View style={{ width: 110 }}>
          <LInput icon="food" placeholder="₹ / trip" keyboardType="numeric" value={meal} onChangeText={setMeal} />
        </View>
        <Text style={{ fontSize: 14, color: C.sub }}>₹ / trip</Text>
      </View>
      <AppButton title={mealBusy ? "Saving…" : mealDirty ? "Save meal" : "Saved ✓"}
        icon="content-save" variant="light" onPress={saveMeal} loading={mealBusy} disabled={!mealDirty} />

      <View style={s.ackTotal}>
        <View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.teal }}>Give driver (diesel + meal)</Text>
          <Text style={{ fontSize: 12, color: C.sub }}>Diesel {rupee(amount)} + meal {rupee(mealVal)}</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "900", color: C.teal }}>{rupee(giveTotal)}</Text>
      </View>
      {saved
        ? <Text style={[s.uploadHint, { marginTop: 6 }]}>Saved — this oil price now applies to every load, the ledger and all reports.</Text>
        : !baseline ? <Text style={{ marginTop: 6, fontSize: 12, color: C.amber }}>No oil price set yet — enter ₹/L above and Save to value the diesel.</Text> : null}
      <View style={{ height: 8 }} />
      <AppButton title="Done" icon="check" onPress={onDone} />
    </>
  );
}

// Ledger: upload freight statement OR bank payment advice (auto-detected).
function LedgerUploadModal({ transportId, expect, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [batch, setBatch] = useState(null);
  const [lastAsset, setLastAsset] = useState(null); // kept so "Process anyway" can re-submit with force
  const isBank = expect === "payment";
  const isAuto = !expect;
  async function pick() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: true });
      if (res.canceled) return;
      const assets = res.assets || [];
      if (assets.length > 1) { await runBatch(assets); return; }
      setBusy(true);
      setLastAsset(assets[0]);
      const r = await uploadLedger(assets[0], transportId);
      setResult(r);
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  async function processAnyway() {
    if (!lastAsset) return;
    setBusy(true);
    try { setResult(await uploadLedger(lastAsset, transportId, true)); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  // Auto-detect + file every PDF, collecting a per-file outcome. (Batch never forces — missing-invoice docs are skipped.)
  async function runBatch(assets) {
    const results = [];
    setBatch({ total: assets.length, results: [] });
    for (const a of assets) {
      let status = "added";
      try {
        const r = await uploadLedger(a, transportId);
        if (!r.kind) status = "failed";
        else if (r.needsConfirm) status = "needsinvoice";
        else if (r.duplicate) status = "duplicate";
      } catch { status = "failed"; }
      results.push({ name: a.name, status });
      setBatch({ total: assets.length, results: [...results] });
    }
  }
  return (
    <Sheet title={isAuto ? "Upload any PDF — auto-detect" : isBank ? "Upload Bank Payment Advice" : "Upload Statement of Freight"} onClose={onClose}>
      {batch ? (
        <BatchList batch={batch} onDone={onDone} />
      ) : result?.needsConfirm ? (
        <>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#b45309", marginBottom: 6 }}>⚠ Invoice not uploaded yet</Text>
          <Text style={{ color: C.sub, marginBottom: 6 }}>
            This {result.kind === "payment" ? "Bank Payment Advice" : "Statement of Freight"} is for {(result.missingInvoices || []).length} {result.kind === "payment" ? "payment line(s)" : "delivery(ies)"} whose Tax Invoice isn't in the system: {(result.missingInvoices || []).join(", ")}.
          </Text>
          <Text style={{ color: C.sub, marginBottom: 12, fontWeight: "700" }}>Nothing saved yet. Process without the invoice, or skip and upload invoices first?</Text>
          <AppButton title={busy ? "Processing…" : "Process without invoice"} icon="check" onPress={processAnyway} loading={busy} />
          <View style={{ height: 8 }} />
          <AppButton title="Skip — upload invoices first" icon="close" variant="light" onPress={() => setResult(null)} />
        </>
      ) : !result ? (
        <>
          <View style={s.uploadBox}>
            <MaterialCommunityIcons name={isAuto ? "auto-fix" : isBank ? "bank" : "file-table"} size={44} color={C.green} />
            <Text style={s.uploadHint}>{isAuto
              ? "Any Nayara PDF — invoice, statement of freight or bank advice. We detect the type and file each record under the right month automatically."
              : isBank
              ? "Matches each bank payment to its delivery — captures gross, TDS & deductions, computes amount received, marks settled."
              : "Maps each delivery row to its invoice — RTKM, freight rate, amount & shortage."}</Text>
            <Text style={[s.uploadHint, { marginTop: 4, fontWeight: "700", color: C.green }]}>Select multiple PDFs to import them all at once.</Text>
          </View>
          <AppButton title="Choose PDF(s)" icon="file-search" onPress={pick} loading={busy} />
          <CancelBtn onClose={onClose} />
        </>
      ) : (
        <>
          <Text style={[s.sheetTitle, { fontSize: 15, color: C.green }]}>✓ Done</Text>
          {result.duplicate && <Text style={{ color: "#92400e", marginBottom: 8 }}>⚠️ This PDF was already uploaded earlier — re-processed, nothing duplicated.</Text>}
          {result.kind === "invoice" ? (
            <Text style={{ color: C.sub, marginBottom: 12 }}>Invoice imported: load {result.invoiceNumber}{result.roName ? ` — ${result.roName}` : ""} (RTKM {result.rtkm || 0}). Date from the invoice.</Text>
          ) : result.kind === "freight" ? (
            <Text style={{ color: C.sub, marginBottom: 12 }}>Statement of Freight imported: {result.created} new, {result.updated} updated, {result.shortagesCreated} driver shortages.</Text>
          ) : result.kind === "payment" ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: C.sub, marginBottom: 6 }}>{result.matched} deliveries settled{result.unmatched ? `, ${result.unmatched} for other periods unmatched` : ""}.</Text>
              {[["Gross freight", rupee(result.totalGross)], ["TDS", "− " + rupee(result.totalTds)], ["Deductions", "− " + rupee(result.totalDed)], ["Received (matched)", rupee(result.totalReceived)], ["Bank check total", rupee(result.checkTotal)]].map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                  <Text style={{ color: C.sub }}>{k}</Text><Text style={{ fontWeight: "700", color: C.ink }}>{v}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: C.red }}>{result.error || "Not recognised."}</Text>
              {result.textPreview ? (
                <View style={{ marginTop: 8, maxHeight: 220, backgroundColor: "#0f172a", borderRadius: 10, padding: 10 }}>
                  <ScrollView><Text style={{ color: "#e2e8f0", fontSize: 11 }} selectable>{result.textPreview}</Text></ScrollView>
                </View>
              ) : null}
            </View>
          )}
          {result.kind ? <UploadValidation result={result} transportId={transportId} /> : null}
          <AppButton title="Done" icon="check" onPress={onDone} />
        </>
      )}
    </Sheet>
  );
}

// After-upload data checks: flag invoices missing their source, and offer to add the
// tanker / assign a driver straight from the invoice.
function UploadValidation({ result, transportId }) {
  const v = result?.validation;
  const [truckAdded, setTruckAdded] = useState(!(v && v.needsTruck));
  const [truckId, setTruckId] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const needDriver = v && (v.needsDriver || v.needsTruck);

  useEffect(() => {
    if (truckAdded && needDriver && !drivers.length) getMembers(transportId, "driver").then(setDrivers).catch(() => {});
  }, [truckAdded, needDriver]);

  if (!v) return null;
  const missing = v.missingInvoices || [];

  async function findTruckId() {
    if (truckId) return truckId;
    const trucks = await getTrucks(transportId);
    const norm = (r) => String(r || "").replace(/\s/g, "").toUpperCase();
    return trucks.find((t) => norm(t.registrationNo) === norm(v.truckReg))?.id || null;
  }
  async function addTruck() {
    setBusy(true);
    try { const t = await createTruck({ transportId, registrationNo: v.truckReg, type: "tanker" }); setTruckId(t.id); setTruckAdded(true); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  async function assign(driverId) {
    setBusy(true);
    try { const tid = await findTruckId(); if (tid) await updateTruck(tid, { assignedDriverId: driverId }); setDone("Driver assigned ✓"); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }

  return (
    <View style={{ marginBottom: 12, gap: 10 }}>
      {missing.length > 0 && (
        <View style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 12 }}>
          <Text style={{ color: "#b45309", fontWeight: "700" }}>⚠ Imported — {missing.length} {result.kind === "payment" ? "payment line(s)" : "delivery(ies)"} have no Invoice yet</Text>
          <Text style={{ color: "#92400e", fontSize: 12, marginTop: 4 }}>{result.kind === "payment" ? "Didn't match any delivery: " : "Saved & marked “invoice pending” — upload the Tax Invoice for: "}{missing.join(", ")}.</Text>
        </View>
      )}
      {result.kind === "invoice" && (v.needsTruck || v.needsDriver) && (
        done ? <Text style={{ color: C.green, fontWeight: "700" }}>{done}</Text> : (
          <View style={{ backgroundColor: "rgba(79,70,229,0.06)", borderRadius: 10, padding: 12 }}>
            <Text style={{ color: "#4338ca", fontWeight: "700", marginBottom: 6 }}>Set up this trip's tanker & driver</Text>
            {!truckAdded ? (
              <>
                <Text style={{ color: C.sub, fontSize: 13, marginBottom: 8 }}>Tanker {v.truckReg} isn't in your fleet yet.</Text>
                <AppButton title={busy ? "Adding…" : `Add tanker ${v.truckReg}`} icon="truck-plus" onPress={addTruck} loading={busy} />
              </>
            ) : needDriver ? (
              <>
                <Text style={{ color: C.sub, fontSize: 13, marginBottom: 8 }}>Assign a driver to {v.truckReg}{v.driverName ? ` (invoice driver: ${v.driverName})` : ""}.</Text>
                {drivers.length === 0 ? <Text style={{ color: C.sub, fontSize: 12 }}>No drivers yet — add one in the Drivers tab, then re-upload.</Text> :
                  <View style={s.chips}>{drivers.map((d) => <Chip key={d.id} label={d.name} onPress={() => assign(d.id)} />)}</View>}
              </>
            ) : null}
          </View>
        )
      )}
    </View>
  );
}

function AddMaintenanceModal({ transportId, trucks, onClose, onDone }) {
  const [f, setF] = useState({ truckId: "", category: "", description: "", cost: "", vendor: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function save() {
    setBusy(true);
    try { await createMaintenance({ ...f, transportId, cost: Number(f.cost) || 0 }); onDone(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Add maintenance" onClose={onClose}>
      <Text style={s.fieldHint}>Truck</Text>
      <View style={s.chips}>
        <Chip label="None" active={!f.truckId} onPress={() => set("truckId")("")} />
        {trucks.map((t) => <Chip key={t.id} label={t.name || t.registrationNo} active={f.truckId === t.id} onPress={() => set("truckId")(t.id)} />)}
      </View>
      <LInput icon="tag" placeholder="Category (tyre / engine / service)" value={f.category} onChangeText={set("category")} />
      <LInput icon="text" placeholder="Description" value={f.description} onChangeText={set("description")} />
      <LInput icon="cash" placeholder="Cost ₹" keyboardType="numeric" value={f.cost} onChangeText={set("cost")} />
      <LInput icon="store" placeholder="Vendor" value={f.vendor} onChangeText={set("vendor")} />
      <AppButton title={busy ? "Saving…" : "Save record"} icon="content-save" onPress={save} loading={busy} />
      <CancelBtn onClose={onClose} />
    </Sheet>
  );
}

// Add extra oil against a specific shipment/delivery — context comes from the ledger row.
function ExtraOilModal({ group, transportId, onClose, onDone }) {
  const lead = group.lead || group.loads[0];
  const [f, setF] = useState({ litres: "", reason: "breakdown", ratePerL: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function save() {
    if (!(Number(f.litres) > 0)) { Alert.alert("Litres", "Enter litres greater than 0."); return; }
    setBusy(true);
    try {
      await addExtraOil({ transportId, loadId: lead.id, shipmentNo: group.shipmentNo, invoiceNumber: lead.invoiceNumber, litres: Number(f.litres) || 0, reason: f.reason, ratePerL: Number(f.ratePerL) || 0, notes: f.notes });
      onDone();
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Add extra oil" onClose={onClose}>
      <View style={{ backgroundColor: "rgba(79,70,229,0.06)", borderRadius: R.md, padding: 12, marginBottom: 12 }}>
        <Text style={{ fontWeight: "800", color: "#4338ca" }}>{group.shipmentNo ? `Shipment ${group.shipmentNo}` : `Invoice ${lead.invoiceNumber || "—"}`}</Text>
        <Text style={{ color: C.sub, marginTop: 2, fontSize: 13 }}>{lead.truckReg || "—"} · {lead.driverName || "no driver"} · planned {group.oil} L</Text>
      </View>
      <Text style={s.fieldHint}>Reason</Text>
      <View style={s.chips}>
        {EXTRA_REASONS.map(([k, l]) => <Chip key={k} label={l} active={f.reason === k} onPress={() => set("reason")(k)} />)}
      </View>
      <View style={{ height: 6 }} />
      <LInput icon="fuel" placeholder="Extra litres given" keyboardType="numeric" value={f.litres} onChangeText={set("litres")} />
      <LInput icon="cash" placeholder="Diesel rate ₹/L (optional)" keyboardType="numeric" value={f.ratePerL} onChangeText={set("ratePerL")} />
      <LInput icon="text" placeholder="Notes (what happened)" value={f.notes} onChangeText={set("notes")} />
      <AppButton title={busy ? "Saving…" : "Save extra oil"} icon="content-save" onPress={save} loading={busy} />
      <CancelBtn onClose={onClose} />
    </Sheet>
  );
}

function AddManagerModal({ transportId, onClose, onDone }) {
  const [f, setF] = useState({ name: "", phone: "", pin: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function save() {
    setBusy(true);
    try { await createMember({ ...f, transportId, role: "manager" }); onDone(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Add manager" onClose={onClose}>
      <LInput icon="account" placeholder="Name" value={f.name} onChangeText={set("name")} />
      <LInput icon="phone" placeholder="Phone" keyboardType="phone-pad" value={f.phone} onChangeText={set("phone")} />
      <LInput icon="lock" placeholder="PIN (4–6 digits)" keyboardType="numeric" value={f.pin} onChangeText={set("pin")} />
      <AppButton title={busy ? "Saving…" : "Save manager"} icon="content-save" onPress={save} loading={busy} />
      <CancelBtn onClose={onClose} />
    </Sheet>
  );
}

function GenerateSalaryModal({ transportId, drivers, onClose, onDone }) {
  const now = new Date();
  const [driverId, setDriverId] = useState(drivers[0]?.id || "");
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Leave log for the selected driver.
  const [leaves, setLeaves] = useState([]);
  const [lv, setLv] = useState({ fromDate: "", toDate: "", paid: false, reason: "" });
  const setL = (k) => (v) => setLv((p) => ({ ...p, [k]: v }));

  const loadLeaves = useCallback(async () => {
    if (!driverId) return setLeaves([]);
    try { setLeaves(await getLeaves(transportId, driverId)); } catch { setLeaves([]); }
  }, [transportId, driverId]);
  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  async function gen() {
    setBusy(true); setMsg("");
    try {
      const p = await generateSalary({ transportId, driverId, period });
      setMsg(`Net ${rupee(p.netPay)} · paid ${p.payableDays}/${p.daysInMonth} days${p.leaveDays ? `, ${p.leaveDays} leave` : ""} · base ${rupee(p.baseSalary)} of ${rupee(p.monthlySalary)}`);
    } catch (e) { setMsg(String(e.message || e)); } finally { setBusy(false); }
  }
  async function saveLeave() {
    if (!lv.fromDate) return;
    try { await addLeave({ transportId, driverId, ...lv, toDate: lv.toDate || lv.fromDate }); setLv({ fromDate: "", toDate: "", paid: false, reason: "" }); loadLeaves(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); }
  }
  async function removeLeave(id) {
    try { await deleteLeave(id); loadLeaves(); } catch (e) { Alert.alert("Error", String(e.message || e)); }
  }

  return (
    <Sheet title="Generate payslip" onClose={onClose}>
      <Text style={s.fieldHint}>Driver</Text>
      <View style={s.chips}>
        {drivers.map((d) => <Chip key={d.id} label={d.name} active={driverId === d.id} onPress={() => setDriverId(d.id)} />)}
      </View>
      <LInput icon="calendar" placeholder="Month (YYYY-MM)" value={period} onChangeText={setPeriod} />
      <AppButton title={busy ? "Generating…" : "Generate"} icon="cash-plus" onPress={gen} loading={busy} disabled={!driverId} />
      {!!msg && <Text style={{ marginTop: 10, color: C.green, fontWeight: "600" }}>{msg}</Text>}
      <Text style={s.fieldHint}>Net = pro-rated base (monthly ÷ days × days worked) − unpaid leave − oil-shortage cuts.</Text>

      <Text style={[s.fieldHint, { marginTop: 14, fontWeight: "700", color: C.ink }]}>Leaves</Text>
      {leaves.map((l) => (
        <View key={l.id} style={s.row}>
          <MaterialCommunityIcons name={l.paid ? "calendar-check" : "calendar-remove"} size={20} color={l.paid ? C.teal : C.amber} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{l.days}d · {l.paid ? "Paid" : "Unpaid"}</Text>
            <Text style={s.rowMeta} numberOfLines={1}>{fmtLeaveRange(l.fromDate, l.toDate)}{l.reason ? ` · ${l.reason}` : ""}</Text>
          </View>
          <TouchableOpacity onPress={() => removeLeave(l.id)}><MaterialCommunityIcons name="trash-can-outline" size={20} color={C.red} /></TouchableOpacity>
        </View>
      ))}
      <LInput icon="calendar-start" placeholder="Leave from (YYYY-MM-DD)" value={lv.fromDate} onChangeText={setL("fromDate")} />
      <LInput icon="calendar-end" placeholder="To (optional, same day)" value={lv.toDate} onChangeText={setL("toDate")} />
      <LInput icon="comment-outline" placeholder="Reason (optional)" value={lv.reason} onChangeText={setL("reason")} />
      <TouchableOpacity onPress={() => setL("paid")(!lv.paid)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
        <MaterialCommunityIcons name={lv.paid ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={lv.paid ? C.green : C.faint} />
        <Text style={{ color: C.ink, fontSize: 14 }}>Paid leave (no salary cut)</Text>
      </TouchableOpacity>
      <AppButton title="Add leave" icon="calendar-plus" variant="light" onPress={saveLeave} disabled={!driverId || !lv.fromDate} />

      <View style={{ height: 10 }} />
      <AppButton title="Done" variant="light" onPress={onDone} />
    </Sheet>
  );
}
const fmtLeaveRange = (from, to) => {
  const f = new Date(from), t = new Date(to);
  const d = (x) => x.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return f.toDateString() === t.toDateString() ? d(f) : `${d(f)} – ${d(t)}`;
};

function AddDriverModal({ transportId, onClose, onDone }) {
  const [f, setF] = useState({ name: "", phone: "", pin: "", baseSalary: "", shortageRatePerUnit: "", joiningDate: "", appAccessEnabled: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function save() {
    setBusy(true);
    try { await createMember({ ...f, transportId, role: "driver", baseSalary: Number(f.baseSalary) || 0, shortageRatePerUnit: Number(f.shortageRatePerUnit) || 0 }); onDone(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Add driver" onClose={onClose}>
      <LInput icon="account" placeholder="Name" value={f.name} onChangeText={set("name")} />
      <LInput icon="phone" placeholder="Phone" keyboardType="phone-pad" value={f.phone} onChangeText={set("phone")} />
      <LInput icon="lock" placeholder="PIN (4–6 digits)" keyboardType="numeric" value={f.pin} onChangeText={set("pin")} />
      <LInput icon="calendar-account" placeholder="Joining date (YYYY-MM-DD)" value={f.joiningDate} onChangeText={set("joiningDate")} />
      <LInput icon="cash" placeholder="Base salary ₹/month" keyboardType="numeric" value={f.baseSalary} onChangeText={set("baseSalary")} />
      <LInput icon="cash-minus" placeholder="Shortage deduction ₹/L" keyboardType="numeric" value={f.shortageRatePerUnit} onChangeText={set("shortageRatePerUnit")} />
      <TouchableOpacity onPress={() => set("appAccessEnabled")(!f.appAccessEnabled)} activeOpacity={0.7}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
        <MaterialCommunityIcons name={f.appAccessEnabled ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={f.appAccessEnabled ? C.green : C.faint} />
        <Text style={{ flex: 1, color: C.ink, fontSize: 14 }}>Allow app / web login (driver can see trips, salary, shortages & upload meter readings)</Text>
      </TouchableOpacity>
      <AppButton title={busy ? "Saving…" : "Save driver"} icon="content-save" onPress={save} loading={busy} />
      <CancelBtn onClose={onClose} />
    </Sheet>
  );
}

function AddTruckModal({ transportId, drivers, onClose, onDone }) {
  const [f, setF] = useState({ type: "tanker", name: "", registrationNo: "", averageKmL: "4", assignedDriverId: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function save() {
    setBusy(true);
    try { await createTruck({ ...f, transportId, averageKmL: Number(f.averageKmL) || 4, assignedDriverId: f.assignedDriverId || null }); onDone(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Add truck" onClose={onClose}>
      <View style={[s.chips, { marginBottom: 10 }]}>
        <Chip label="Tanker" icon="tanker-truck" active={f.type === "tanker"} onPress={() => set("type")("tanker")} />
        <Chip label="Truck" icon="truck" active={f.type === "truck"} onPress={() => set("type")("truck")} />
      </View>
      <LInput icon="tag" placeholder="Name" value={f.name} onChangeText={set("name")} />
      <LInput icon="card-text" placeholder="Registration No." value={f.registrationNo} onChangeText={set("registrationNo")} />
      <LInput icon="speedometer" placeholder="Mileage km/L" keyboardType="numeric" value={f.averageKmL} onChangeText={set("averageKmL")} />
      <Text style={s.fieldHint}>Assign driver</Text>
      <View style={s.chips}>
        <Chip label="None" active={!f.assignedDriverId} onPress={() => set("assignedDriverId")("")} />
        {drivers.map((d) => <Chip key={d.id} label={d.name} active={f.assignedDriverId === d.id} onPress={() => set("assignedDriverId")(d.id)} />)}
      </View>
      <View style={{ height: 12 }} />
      <AppButton title={busy ? "Saving…" : "Save truck"} icon="content-save" onPress={save} loading={busy} />
      <CancelBtn onClose={onClose} />
    </Sheet>
  );
}

function CancelBtn({ onClose }) {
  return <TouchableOpacity onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>;
}

function OilAvgCard({ transport, onSaved }) {
  const [avg, setAvg] = useState(String(transport.tankerAvg ?? 4.5));
  const [price, setPrice] = useState(String(transport.dieselPrice ?? 0));
  const [meal, setMeal] = useState(String(transport.mealAllowancePerTrip ?? 0));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAvg(String(transport.tankerAvg ?? 4.5)); setPrice(String(transport.dieselPrice ?? 0));
    setMeal(String(transport.mealAllowancePerTrip ?? 0));
  }, [transport.id, transport.tankerAvg, transport.dieselPrice, transport.mealAllowancePerTrip]);
  async function save() {
    const v = Number(avg);
    if (!(v > 0)) return;
    setBusy(true);
    try { await updateTransport(transport.id, { tankerAvg: v, dieselPrice: Number(price) || 0, mealAllowancePerTrip: Number(meal) || 0 }); Alert.alert("Saved", `Average ${v} km/L · diesel ₹${Number(price) || 0}/L · meal ₹${Number(meal) || 0}/trip. Reports updated.`); onSaved && onSaved(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  const Field = ({ label, icon, unit, value, onChangeText, placeholder, hint }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink, marginBottom: 4 }}>{label}</Text>
      <View style={[s.inputWrap, { marginBottom: 0 }]}>
        <MaterialCommunityIcons name={icon} size={18} color={C.faint} />
        <TextInput style={s.input} value={value} onChangeText={onChangeText} keyboardType="numeric" placeholder={placeholder} placeholderTextColor={C.faint} />
        <Text style={{ fontSize: 12, fontWeight: "700", color: C.sub }}>{unit}</Text>
      </View>
      <Text style={[s.fieldHint, { marginTop: 4 }]}>{hint}</Text>
    </View>
  );
  return (
    <Card style={{ marginTop: S.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <MaterialCommunityIcons name="fuel" size={20} color="#2563eb" />
        <Text style={{ fontSize: 16, fontWeight: "800", color: C.ink }}>Diesel & trip settings</Text>
      </View>
      <Text style={[s.fieldHint, { marginBottom: 10 }]}>These three numbers turn each trip into real ₹ in your Spend & Profit reports. Set them once.</Text>
      <Field label="Tanker mileage" icon="speedometer" unit="km / L" value={avg} onChangeText={setAvg} placeholder="e.g. 4.5"
        hint="How far the tanker runs on 1 litre. Sets the diesel for each trip." />
      <Field label="Diesel price" icon="currency-inr" unit="₹ / litre" value={price} onChangeText={setPrice} placeholder="e.g. 95"
        hint="What you pay for 1 litre of diesel. Turns diesel given into a ₹ cost." />
      <Field label="Meal allowance" icon="food" unit="₹ / trip" value={meal} onChangeText={setMeal} placeholder="e.g. 1000"
        hint="Flat food / expense money you give the driver each trip. Put 0 if none." />
      <AppButton title={busy ? "Saving…" : "Save settings"} icon="content-save" onPress={save} disabled={busy} style={{ marginTop: 4 }} />
    </Card>
  );
}

// Owner self-service "fresh start": wipe this transport's transactional data (test uploads etc.).
function DangerCard({ transport, onWiped }) {
  const [includeFleet, setIncludeFleet] = useState(false);
  const [busy, setBusy] = useState(false);
  function ask() {
    Alert.alert(
      `Wipe all data for "${transport.name}"?`,
      includeFleet
        ? "Permanently deletes ALL loads, shortages, salaries, settlements, uploads, FASTag, maintenance, leaves, extra oil, meter readings and notifications — AND this transport's trucks & driver/manager logins. Master pumps and your account are kept. Cannot be undone."
        : "Permanently deletes ALL loads, shortages, salaries, settlements, uploads, FASTag, maintenance, leaves, extra oil, meter readings and notifications for this transport. Trucks, drivers, master pumps and your account are kept. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Wipe data", style: "destructive", onPress: doWipe },
      ]
    );
  }
  async function doWipe() {
    setBusy(true);
    try {
      const d = await wipeTransport(transport.id, includeFleet);
      Alert.alert("Fresh start done", `Removed ${d.total} record(s).`);
      onWiped && onWiped();
    } catch (e) { Alert.alert("Error", String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <Card style={{ marginTop: S.md, borderWidth: 1, borderColor: "rgba(225,29,72,0.3)", backgroundColor: "rgba(225,29,72,0.03)" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <MaterialCommunityIcons name="alert-octagon" size={20} color={C.red} />
        <Text style={{ fontSize: 16, fontWeight: "800", color: C.red }}>Danger zone — fresh start</Text>
      </View>
      <Text style={s.fieldHint}>Tested with random PDFs? Wipe all of this transport's data and start clean. Master pumps and your login are never touched; other owners are unaffected.</Text>
      <TouchableOpacity onPress={() => setIncludeFleet((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
        <MaterialCommunityIcons name={includeFleet ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={includeFleet ? C.red : C.faint} />
        <Text style={{ color: C.ink, fontSize: 14 }}>Also remove trucks & driver/manager logins</Text>
      </TouchableOpacity>
      <AppButton title={busy ? "Wiping…" : "Wipe my data"} icon="trash-can-outline" variant="danger" onPress={ask} disabled={busy} />
    </Card>
  );
}

// Reconciliation hero: freight says N deliveries should pay, bank settled M — the gap (₹ still due)
// is shown so an outstanding amount never slips through.
function ReconCard({ summary }) {
  const total = summary?.loads || 0;
  if (!total) return null;
  const settled = summary.settled || 0, pending = summary.pending || 0, ok = pending === 0;
  return (
    <LinearGradient colors={ok ? ["#34d399", "#22d3ee"] : ["#fbbf24", "#fb7185"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: S.md }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={ok ? "check-decagram" : "alert-decagram"} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{ok ? `All ${total} settled` : `${pending} settlement${pending > 1 ? "s" : ""} pending`}</Text>
        <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: 11, marginTop: 1 }}>{ok ? "Bank settled every delivery." : `${settled}/${total} settled · ${pending} pending`}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: "700" }}>{ok ? "RECEIVED" : "STILL DUE"}</Text>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 19 }}>{rupee(ok ? summary.totalReceived : summary.pendingFreight)}</Text>
      </View>
    </LinearGradient>
  );
}

const NOTIF_ICON = { gmail: "email-newsletter", invoice: "file-document", freight: "clipboard-list", payment: "bank", info: "bell" };
function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString("en-IN");
}
function NotificationsModal({ items, onClose }) {
  return (
    <Sheet title="Notifications" onClose={onClose}>
      {items.length === 0 ? <EmptyState icon="bell-check-outline" text="You're all caught up" /> :
        items.map((n) => (
          <View key={n.id} style={s.row}>
            <View style={s.rowIcon}><MaterialCommunityIcons name={NOTIF_ICON[n.type] || "bell"} size={20} color={C.green} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{n.title}</Text>
              {n.body ? <Text style={s.rowMeta} numberOfLines={1}>{n.body}</Text> : null}
              <Text style={[s.rowMeta, { color: C.faint }]}>{timeAgo(n.createdAt)}</Text>
            </View>
          </View>
        ))}
      <View style={{ height: 6 }} />
      <AppButton title="Close" variant="light" onPress={onClose} />
    </Sheet>
  );
}

// Hero stat: gradient card + circular % badge + big number (dashboard "first-eye" metrics).
function RingStatRN({ label, value, percent = 0, sub, colors }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, ...shadow, shadowOpacity: 0.12 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 5, borderColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{pct}%</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22 }} numberOfLines={1}>{value}</Text>
        <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </LinearGradient>
  );
}

// Rich ledger delivery row — pump number/name and tanker/driver shown stacked so all data fits.
function LedgerRow({ l }) {
  const settled = l.settlementStatus === "settled";
  return (
    <View style={s.row}>
      <View style={s.rowIcon}><MaterialCommunityIcons name="gas-station" size={20} color={C.green} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{l.roName || l.cmsCode || "—"}{!l.hasInvoice ? "  ⚠" : ""}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>{fmtDay(l.invoiceDate || l.loadDate)} · inv {l.invoiceNumber || "—"}{!l.hasInvoice ? " (pending)" : ""} · {l.deliveredQtyL || 0}L · short {l.shortageL || 0}L</Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          <MaterialCommunityIcons name="truck" size={11} color={C.faint} /> {l.truckReg || "—"}
          {"  "}<MaterialCommunityIcons name="account" size={11} color={C.faint} /> {l.driverName || "—"} · RTKM {l.rtkm || 0}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.rowRight, { color: settled ? C.green : C.ink, fontSize: 13 }]}>{rupee(l.freightAmount)}</Text>
        <Text style={[s.rowMeta, settled && { color: C.green }]}>{settled ? `net ${rupee(l.netReceived)}` : "pending"}</Text>
        {settled && l.paidDate ? <Text style={s.rowMeta}>settled {fmtDay(l.paidDate)}</Text> : null}
      </View>
    </View>
  );
}

function ListRow({ icon, title, meta, right, rightTone }) {
  const toneColor = rightTone === "red" ? C.red : rightTone === "green" ? C.green : C.ink;
  return (
    <View style={s.row}>
      <View style={s.rowIcon}><MaterialCommunityIcons name={icon} size={20} color={C.green} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text>
      </View>
      {right ? <Text style={[s.rowRight, { color: toneColor }]}>{right}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  fab: { position: "absolute", right: 16, bottom: 96, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.green, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 30, ...shadow },
  fabText: { color: "#fff", fontWeight: "800" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: S.md },
  section: { fontSize: 17, fontWeight: "800", color: C.ink, marginTop: S.xl, marginBottom: S.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: R.md, padding: 12, marginBottom: 8, ...shadow, shadowOpacity: 0.04 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontWeight: "700", color: C.ink, fontSize: 15 },
  rowMeta: { color: C.sub, fontSize: 12, marginTop: 1 },
  rowRight: { fontWeight: "800", fontSize: 14 },
  // shipment grouping
  shipCard: { backgroundColor: "rgba(79,70,229,0.05)", borderRadius: R.md, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "rgba(79,70,229,0.12)" },
  shipHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  shipTitle: { fontWeight: "800", color: "#4338ca", fontSize: 13 },
  shipMeta: { color: C.sub, fontSize: 12 },
  shipOil: { fontWeight: "800", color: "#2563eb", fontSize: 13 },
  shipSub: { color: C.sub, fontSize: 11, marginBottom: 8, marginLeft: 21 },
  // invoice acknowledgement (diesel for this trip)
  ackStat: { width: "50%", paddingVertical: 8, paddingRight: 8 },
  ackStatLabel: { fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: 0.4 },
  ackStatValue: { fontSize: 16, fontWeight: "800", color: C.ink, marginTop: 2 },
  ackTotal: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: "rgba(14,165,164,0.10)", borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12 },
  extraRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 8, marginTop: 6, backgroundColor: "rgba(225,29,72,0.06)", borderRadius: R.sm },
  extraText: { color: "#e11d48", fontWeight: "700", fontSize: 12 },
  extraAdd: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, marginTop: 8, backgroundColor: "rgba(37,99,235,0.08)", borderRadius: R.sm },
  extraAddText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },
  // auth
  authHero: { paddingTop: 80, paddingBottom: 48, alignItems: "center", borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  authLogo: { width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  authTitle: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: 0.5 },
  authSub: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontSize: 13 },
  authCardTitle: { color: C.ink, fontSize: 20, fontWeight: "800", marginBottom: 2 },
  authCardSub: { color: C.sub, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  authShow: { color: C.sub, fontSize: 13, fontWeight: "700" },
  authNote: { color: C.sub, fontSize: 12, marginTop: 10, textAlign: "center", lineHeight: 17 },
  authFeatures: { flexDirection: "row", justifyContent: "space-around", marginTop: 18, paddingHorizontal: 4 },
  authFeat: { alignItems: "center", gap: 5, flex: 1 },
  authFeatText: { color: C.sub, fontSize: 11.5, fontWeight: "600", textAlign: "center" },
  segment: { flexDirection: "row", backgroundColor: C.bg, borderRadius: R.md, padding: 4, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: R.sm },
  segBtnActive: { backgroundColor: "#fff", ...shadow, shadowOpacity: 0.06 },
  segText: { color: C.sub, fontWeight: "600" }, segTextActive: { color: C.green, fontWeight: "800" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: R.md, paddingHorizontal: 14, marginBottom: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: C.ink },
  fieldHint: { color: C.sub, fontSize: 13, marginBottom: 6, marginTop: 2 },
  // sheet
  sheetBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: 30, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14, color: C.ink },
  uploadBox: { alignItems: "center", backgroundColor: C.bg, borderRadius: R.lg, padding: S.xl, marginBottom: 14, borderWidth: 1.5, borderColor: C.line, borderStyle: "dashed" },
  uploadHint: { color: C.sub, textAlign: "center", marginTop: 10, lineHeight: 19 },
  cancel: { alignItems: "center", paddingVertical: 14, marginTop: 6 },
  cancelText: { color: C.sub, fontWeight: "700" },
});
