import mongoose from "mongoose";

// One connected Gmail inbox per transport (the email that receives company invoices/shortage PDFs).
const GmailConnectionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", required: true, unique: true },
    email: { type: String, default: "" },
    refreshTokenEnc: { type: String, default: "" }, // AES-encrypted refresh token
    // Sender domains/emails to bulk-import statements from (e.g. "@nayaraenergy.com",
    // "@blackbuck.com"). A bare domain matches every address at that company.
    senders: { type: [String], default: [] },
    connectedAt: { type: Date, default: () => new Date() },
    lastScanAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export function toGmail(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    transportId: String(o.transportId),
    email: o.email || "",
    connected: !!o.refreshTokenEnc,
    senders: o.senders || [],
    connectedAt: o.connectedAt,
    lastScanAt: o.lastScanAt,
  };
}

export const GmailConnection =
  mongoose.models.GmailConnection || mongoose.model("GmailConnection", GmailConnectionSchema);
