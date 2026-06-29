"use client";
import { api } from "@/lib/clientApi";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Register the service worker, ask permission, subscribe, and store the subscription server-side.
// Returns true on success; throws with a readable message otherwise.
export async function enableWebPush(transportId) {
  if (!pushSupported()) throw new Error("This browser doesn't support push notifications.");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Push isn't configured (missing VAPID key).");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications were blocked. Allow them in your browser settings.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  }
  await api("/api/push/register", { method: "POST", body: { transportId, platform: "web", subscription: sub.toJSON() } });
  return true;
}
