import mongoose from "mongoose";

// In-app notification for an owner/transport — e.g. a new invoice/PDF arrived in the connected
// Gmail, or a document was imported. Shown in the header bell on web + mobile.
const NotificationSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    type: { type: String, default: "info" }, // gmail | invoice | freight | payment | shortage | info
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    link: { type: String, default: "" },   // in-app path to open (e.g. /app/ledger)
    dedupeKey: { type: String, default: "" }, // prevents the same Gmail PDF notifying twice
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ transportId: 1, createdAt: -1 });
NotificationSchema.index({ transportId: 1, dedupeKey: 1 });

export function toNotification(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    type: o.type || "info",
    title: o.title || "",
    body: o.body || "",
    link: o.link || "",
    read: !!o.read,
    createdAt: o.createdAt,
  };
}

export const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
