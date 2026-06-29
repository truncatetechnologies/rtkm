import { dbConnect } from "@/lib/mongoose";
import { Notification, User } from "@/lib/models";
import { sendPush, sendPushToUser } from "@/lib/services/push";

// Create an in-app notification for a transport. When `dedupeKey` is given, the same event
// (e.g. one Gmail PDF) won't notify twice. Best-effort: never throws into the caller.
export async function createNotification({ ownerId, transportId, type = "info", title, body = "", link = "", dedupeKey = "" }) {
  try {
    await dbConnect();
    if (dedupeKey) {
      const existing = await Notification.findOne({ transportId, dedupeKey });
      if (existing) return existing;
    }
    const n = await Notification.create({ ownerId, transportId, type, title, body, link, dedupeKey });
    // Fire OS push to all registered devices/browsers (works when the app is closed).
    await sendPush(transportId, { title, body, data: { link, type } });
    return n;
  } catch {
    return null;
  }
}

// Notify every admin (there's typically one — the platform owner). Admins aren't tied to a transport,
// so notifications are stored per-admin (ownerId = admin) with transportId null and pushed by userId.
// Used for the RTKM approval queue. Best-effort: never throws into the caller.
export async function notifyAdmins({ type = "approval", title, body = "", link = "", dedupeKey = "" }) {
  try {
    await dbConnect();
    const admins = await User.find({ role: "admin" }).select("_id");
    for (const a of admins) {
      if (dedupeKey) {
        const existing = await Notification.findOne({ ownerId: a._id, dedupeKey });
        if (existing) continue;
      }
      await Notification.create({ ownerId: a._id, transportId: null, type, title, body, link, dedupeKey });
      await sendPushToUser(a._id, { title, body, data: { link, type } });
    }
  } catch {
    /* best-effort */
  }
}
