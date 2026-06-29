import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, Linking, ScrollView, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { getPump } from "../../lib/db";
import { C, R, S } from "../../lib/theme";
import { Card, AppButton, ScreenBg, LinearGradient, MaterialCommunityIcons } from "../../components/ui";

function haversineKm(a, b, c, d) {
  const R6 = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(c - a), dLng = toRad(d - b);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return R6 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function PumpDetail() {
  const { id } = useLocalSearchParams();
  const [pump, setPump] = useState(null);
  const [distance, setDistance] = useState(null);

  useEffect(() => { (async () => setPump(await getPump(id)))(); }, [id]);
  const hasCoords = pump && pump.lat != null && pump.lng != null;

  function openInMaps() {
    if (!hasCoords) return;
    const { lat, lng } = pump;
    const label = encodeURIComponent(pump.roName || "Pump");
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps?q=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`));
  }
  async function showDistance() {
    if (!hasCoords) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Location permission is required."); return; }
    const loc = await Location.getCurrentPositionAsync({});
    setDistance(haversineKm(loc.coords.latitude, loc.coords.longitude, pump.lat, pump.lng).toFixed(1));
  }

  if (!pump) return <ScreenBg><Text style={{ padding: 16, color: C.sub }}>Loading…</Text></ScreenBg>;

  return (
    <ScreenBg>
    <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[C.gradFrom, C.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="gas-station" size={26} color="#fff" /></View>
        <Text style={styles.heroName}>{pump.roName}</Text>
        <Text style={styles.heroMeta}>{pump.cmsCode} · {pump.rtkm} km RTKM</Text>
      </LinearGradient>

      <Card soft style={{ marginTop: S.md }}>
        <Row icon="barcode" label="CMS Code" value={pump.cmsCode} />
        <Row icon="map-marker-distance" label="RTKM" value={`${pump.rtkm} km`} />
        <Row icon="city" label="City" value={pump.city || "--"} />
        <Row icon="map-marker" label="Address" value={pump.address || "--"} />
        <Row icon="crosshairs-gps" label="Coordinates" value={hasCoords ? `${pump.lat}, ${pump.lng}` : "Not set"} />
        {distance != null && <Row icon="navigation" label="Distance from you" value={`${distance} km`} last />}
      </Card>

      {hasCoords ? (
        <>
          <AppButton title="Open pump in Maps" icon="map-marker-radius" variant="blue" onPress={openInMaps} style={{ marginTop: S.lg }} />
          <AppButton title="Distance from my location" icon="crosshairs-gps" variant="light" onPress={showDistance} style={{ marginTop: 10 }} />
        </>
      ) : (
        <View style={styles.warn}>
          <MaterialCommunityIcons name="map-marker-off" size={18} color="#92400e" />
          <Text style={styles.warnText}>Location not added for this pump yet.</Text>
        </View>
      )}
    </ScrollView>
    </ScreenBg>
  );
}

function Row({ icon, label, value, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <MaterialCommunityIcons name={icon} size={18} color={C.faint} style={{ width: 26 }} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  hero: { borderRadius: R.xl, padding: S.xl, alignItems: "center" },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  heroName: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  heroMeta: { color: "rgba(255,255,255,0.9)", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowLabel: { color: C.sub, fontSize: 14, width: 110 },
  rowValue: { flex: 1, color: C.ink, fontWeight: "700", fontSize: 15, textAlign: "right" },
  warn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amberLight, padding: 14, borderRadius: R.md, marginTop: S.lg },
  warnText: { color: "#92400e", fontWeight: "600" },
});
