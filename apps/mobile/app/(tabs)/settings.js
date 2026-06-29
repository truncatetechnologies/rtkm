import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from "react-native";
import { getServerUrl, setServerUrl } from "../../lib/config";
import { syncFromServer } from "../../lib/api";
import { C, R, S } from "../../lib/theme";
import { Card, AppButton, GradientHeader, ScreenBg, MaterialCommunityIcons } from "../../components/ui";

export default function Settings() {
  const [server, setServer] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => { getServerUrl().then(setServer); }, []);

  async function save() { await setServerUrl(server.trim()); setStatus("✓ Server URL saved."); }
  async function sync() {
    setBusy(true); setStatus("");
    try {
      await setServerUrl(server.trim());
      const r = await syncFromServer();
      setStatus(`✓ Synced — ${r.changed} updated, ${r.total} pumps saved.`);
    } catch (e) { Alert.alert("Sync failed", String(e.message || e)); } finally { setBusy(false); }
  }

  return (
    <ScreenBg>
      <GradientHeader title="Settings" subtitle="Server & data" icon="cog" />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="server-network" size={20} color={C.green} />
            <Text style={styles.title}>Server connection</Text>
          </View>
          <Text style={styles.hint}>On a real phone, use your computer's Wi-Fi IP (e.g. http://192.168.1.5:3000), not localhost.</Text>
          <TextInput
            value={server} onChangeText={setServer} autoCapitalize="none" keyboardType="url"
            placeholder="http://192.168.1.5:3000" placeholderTextColor={C.faint} style={styles.input}
          />
          <AppButton title="Save" icon="content-save" onPress={save} style={{ marginTop: 12 }} />
          <AppButton title={busy ? "Syncing…" : "Sync data now"} icon="cloud-download" variant="blue" onPress={sync} disabled={busy} style={{ marginTop: 10 }} />
          {!!status && <Text style={styles.status}>{status}</Text>}
        </Card>

        <Card soft style={{ marginTop: S.md }}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="information-outline" size={20} color={C.sub} />
            <Text style={styles.title}>About</Text>
          </View>
          <Text style={styles.about}>RTKM Fuel Planner & Transport Manager. Pump data works offline once synced.</Text>
        </Card>
      </ScrollView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { fontSize: 16, fontWeight: "800", color: C.ink },
  hint: { color: C.sub, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  input: { backgroundColor: C.bg, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: C.ink },
  status: { marginTop: 12, color: C.greenDark, fontWeight: "600" },
  about: { color: C.sub, fontSize: 14, lineHeight: 20 },
});
