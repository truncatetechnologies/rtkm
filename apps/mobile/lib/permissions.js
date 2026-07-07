import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";

// Request every device permission the app uses, up front on launch. Best-effort — each is wrapped
// so a denial or an unsupported platform never throws. Used by admin / transporter / driver:
//  - notifications: gate-in / shortage / expiry alerts (push)
//  - camera + photos: meter-reading photos, PDF picks
//  - location: "distance to pump" on the calculator
let requested = false;
export async function requestAllPermissions() {
  if (requested) return;
  requested = true;
  try { await Notifications.requestPermissionsAsync(); } catch {}
  try { await ImagePicker.requestCameraPermissionsAsync(); } catch {}
  try { await ImagePicker.requestMediaLibraryPermissionsAsync(); } catch {}
  try { await Location.requestForegroundPermissionsAsync(); } catch {}
}
