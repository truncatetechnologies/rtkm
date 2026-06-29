import AsyncStorage from "@react-native-async-storage/async-storage";

// Default server URL. On a real device use your machine's LAN IP, e.g.
// http://192.168.1.5:3000 — change it in the Settings screen.
const DEFAULT_SERVER = "http://localhost:3000";

const KEY_SERVER = "rtkm.serverUrl";
const KEY_TOKEN = "rtkm.adminToken";
const KEY_USER = "rtkm.adminUser";
const KEY_LASTSYNC = "rtkm.lastSync";

export async function getServerUrl() {
  return (await AsyncStorage.getItem(KEY_SERVER)) || DEFAULT_SERVER;
}
export async function setServerUrl(url) {
  await AsyncStorage.setItem(KEY_SERVER, url.replace(/\/+$/, ""));
}

export async function getToken() {
  return AsyncStorage.getItem(KEY_TOKEN);
}
export async function setToken(t) {
  if (t) await AsyncStorage.setItem(KEY_TOKEN, t);
  else await AsyncStorage.removeItem(KEY_TOKEN);
}

export async function getUser() {
  const raw = await AsyncStorage.getItem(KEY_USER);
  return raw ? JSON.parse(raw) : null;
}
export async function setUser(u) {
  if (u) await AsyncStorage.setItem(KEY_USER, JSON.stringify(u));
  else await AsyncStorage.removeItem(KEY_USER);
}

export async function getLastSync() {
  return (await AsyncStorage.getItem(KEY_LASTSYNC)) || "1970-01-01T00:00:00.000Z";
}
export async function setLastSync(iso) {
  await AsyncStorage.setItem(KEY_LASTSYNC, iso);
}
