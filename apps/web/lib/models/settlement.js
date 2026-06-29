import mongoose from "mongoose";

// A bank payment advice that reconciles freight loads (gross − TDS − deductions = net received).
const SettlementSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    company: { type: String, default: "" },
    paymentDocNo: { type: String, default: "" },
    utr: { type: String, default: "" },
    valueDate: { type: String, default: "" },
    total: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    unmatchedRefs: { type: [String], default: [] },
    lines: { type: mongoose.Schema.Types.Mixed, default: [] },
    sourcePdfId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", default: null },
  },
  { timestamps: true }
);

export function toSettlement(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    company: o.company || "",
    paymentDocNo: o.paymentDocNo || "",
    utr: o.utr || "",
    valueDate: o.valueDate || "",
    total: o.total || 0,
    matchedCount: o.matchedCount || 0,
    unmatchedRefs: o.unmatchedRefs || [],
    createdAt: o.createdAt,
  };
}

export const Settlement = mongoose.models.Settlement || mongoose.model("Settlement", SettlementSchema);
