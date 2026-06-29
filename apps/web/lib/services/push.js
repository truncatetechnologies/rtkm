import { dbConnect } from "@/lib/mongoose";
import { PushSubscription } from "@/lib/models";

let webpush = null;
function getWebPush() {
  if (webpush) return webpush;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return null;
  // require lazily so the app still runs if web-push / VAPID isn't set up.
  const wp = require("web-push");
  wp.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@rtkm.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  webpush = wp;
  return wp;
}

// Send an OS push to every device/browser registered for a transport. Best-effort: a failure for
// one device never throws into the caller, and dead subscriptions are pruned.
export async function sendPush(transportId, msg) {
  try {
    await dbConnect();
    await deliver(await PushSubscription.find({ transportId }), msg);
  } catch { /* best-effort */ }
}

// Same, but addressed to one USER's devices (used for the admin, who isn't tied to a transport).
export async function sendPushToUser(userId, msg) {
  try {
    await dbConnect();
    await deliver(await PushSubscription.find({ userId }), msg);
  } catch { /* best-effort */ }
}

async function deliver(subs, { title, body = "", data = {} }) {
  try {
    if (!subs.length) return;

    // --- Expo devices (batched) ---
    const expoTokens = subs.filter((s) => s.platform === "expo" && s.token).map((s) => s.token);
    if (expoTokens.length) {
      const messages = expoTokens.map((to) => ({ to, title, body, sound: "default", data, priority: "high", channelId: "default" }));
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });
      } catch {}
    }

    // --- Web browsers ---
    const wp = getWebPush();
    const webSubs = subs.filter((s) => s.platform === "web" && s.subscription);
    if (wp && webSubs.length) {
      const payload = JSON.stringify({ title, body, data });
      await Promise.all(webSubs.map(async (s) => {
        try { await wp.sendNotification(s.subscription, payload); }
        catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id }); }
      }));
    }
  } catch {
    // swallow — push is best-effort
  }
}
