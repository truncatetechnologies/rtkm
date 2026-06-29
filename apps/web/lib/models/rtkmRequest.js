import mongoose from "mongoose";

// A proposed change to a pump's master RTKM, raised when an uploaded PDF's RTKM differs from the
// current master value. An admin approves (updates master Pump.rtkm) or rejects.
const RtkmRequestSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null },
    cmsCode: { type: String, default: "", index: true },
    roName: { type: String, default: "" },
    currentRtkm: { type: Number, default: 0 },   // master value at request time
    proposedRtkm: { type: Number, default: 0 },  // value seen in the PDF
    source: { type: String, default: "" },       // "invoice" | "freight"
    invoiceNumber: { type: String, default: "" },
    // who triggered it (for context)
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    decidedBy: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RtkmRequestSchema.index({ status: 1, createdAt: -1 });

export function toRtkmRequest(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    cmsCode: o.cmsCode || "",
    roName: o.roName || "",
    currentRtkm: o.currentRtkm || 0,
    proposedRtkm: o.proposedRtkm || 0,
    source: o.source || "",
    invoiceNumber: o.invoiceNumber || "",
    status: o.status || "pending",
    createdAt: o.createdAt,
    decidedAt: o.decidedAt,
  };
}

export const RtkmRequest = mongoose.models.RtkmRequest || mongoose.model("RtkmRequest", RtkmRequestSchema);
