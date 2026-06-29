import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// Show the banner even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

// Ask permission, get the Expo push token, and hand it to `save(token)`.
// No-ops gracefully on simulators or when no EAS projectId is configured (needs a dev/EAS build).
export async function registerForPush(save) {
  try {
    if (!Device.isDevice) return null; // push only delivers to physical devices
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default", importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (token && save) await save(token);
    return token;
  } catch {
    return null; // e.g. no projectId yet — set up EAS to enable device push
  }
}
