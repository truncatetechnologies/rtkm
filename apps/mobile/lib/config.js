import AsyncStorage from "@react-native-async-storage/async-storage";

// Fixed backend — baked in so users (admin / transporter / driver) never configure a server.
// For local development, temporarily point this at your machine, e.g. "http://192.168.1.5:3000".
const SERVER_URL = "https://rtkm-web.vercel.app";

const KEY_TOKEN = "rtkm.adminToken";
const KEY_USER = "rtkm.adminUser";
const KEY_LASTSYNC = "rtkm.lastSync";

export async function getServerUrl() {
  return SERVER_URL;
}
// Kept as a no-op so any old callers don't break; the server is fixed and not user-editable.
export async function setServerUrl() {}

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
