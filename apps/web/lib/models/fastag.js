import mongoose from "mongoose";

// A per-tanker FASTag transaction (from the IDFC/per-tag statement). Tolls are the real cost.
const FastagTxnSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    provider: { type: String, default: "blackbuck" },
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },
    vehicleNo: { type: String, default: "", index: true },
    type: { type: String, enum: ["toll", "recharge"], required: true },
    amount: { type: Number, default: 0 },
    plaza: { type: String, default: "" },
    txnId: { type: String, default: "" },
    txnDate: { type: Date, default: null },
    period: { type: String, default: "" }, // YYYY-MM
  },
  { timestamps: true }
);
FastagTxnSchema.index({ transportId: 1, txnId: 1 }, { unique: true, partialFilterExpression: { txnId: { $type: "string", $ne: "" } } });
FastagTxnSchema.index({ transportId: 1, type: 1, period: 1 });

export function toFastagTxn(o) {
  o = o.toObject ? o.toObject() : o;
  return { id: String(o._id), vehicleNo: o.vehicleNo || "", type: o.type, amount: o.amount || 0, plaza: o.plaza || "", txnId: o.txnId || "", txnDate: o.txnDate, period: o.period || "" };
}

// A BOSS wallet movement (top-up, recharge sent to a tag, order payment, service fee, refund).
const FastagWalletTxnSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    provider: { type: String, default: "blackbuck" },
    sign: { type: Number, default: -1 }, // +1 credit, -1 debit
    desc: { type: String, default: "" },
    category: { type: String, default: "other" }, // topup | recharge | orderpayment | servicefee | refund | other
    amount: { type: Number, default: 0 },
    vehicleNo: { type: String, default: "" },
    txnId: { type: String, default: "" },
    txnDate: { type: Date, default: null },
    period: { type: String, default: "" },
    // Review of non-toll charges: pending → expected (accepted) | disputed (raise with BlackBuck).
    reviewStatus: { type: String, enum: ["pending", "expected", "disputed"], default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
FastagWalletTxnSchema.index({ transportId: 1, txnId: 1 }, { unique: true, partialFilterExpression: { txnId: { $type: "string", $ne: "" } } });
FastagWalletTxnSchema.index({ transportId: 1, period: 1 });

export function toWalletTxn(o) {
  o = o.toObject ? o.toObject() : o;
  return { id: String(o._id), sign: o.sign, desc: o.desc || "", category: o.category || "other", amount: o.amount || 0, vehicleNo: o.vehicleNo || "", txnId: o.txnId || "", txnDate: o.txnDate, period: o.period || "", reviewStatus: o.reviewStatus || "pending", reviewNote: o.reviewNote || "" };
}

export const FastagTxn = mongoose.models.FastagTxn || mongoose.model("FastagTxn", FastagTxnSchema);
export const FastagWalletTxn = mongoose.models.FastagWalletTxn || mongoose.model("FastagWalletTxn", FastagWalletTxnSchema);
