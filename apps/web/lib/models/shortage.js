import mongoose from "mongoose";

// Oil shortage reported by the company (via a shortage PDF), linked to a load by invoice number.
const ShortageSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", default: null },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    invoiceNumber: { type: String, default: "", index: true },
    shortageL: { type: Number, default: 0 },
    ratePerUnit: { type: Number, default: 0 }, // snapshot of driver rate at report time
    shortageValue: { type: Number, default: 0 }, // shortageL * ratePerUnit (deduction amount)
    status: { type: String, enum: ["open", "deducted", "waived"], default: "open", index: true },
    payslipId: { type: mongoose.Schema.Types.ObjectId, ref: "SalaryRecord", default: null },
    sourcePdfId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", default: null },
    reportedAt: { type: Date, default: () => new Date() },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export function toShortage(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    transportId: o.transportId ? String(o.transportId) : null,
    loadId: o.loadId ? String(o.loadId) : null,
    driverId: o.driverId ? String(o.driverId) : null,
    invoiceNumber: o.invoiceNumber || "",
    shortageL: o.shortageL || 0,
    ratePerUnit: o.ratePerUnit || 0,
    shortageValue: o.shortageValue || 0,
    status: o.status || "open",
    payslipId: o.payslipId ? String(o.payslipId) : null,
    reportedAt: o.reportedAt,
    notes: o.notes || "",
    createdAt: o.createdAt,
  };
}

export const Shortage = mongoose.models.Shortage || mongoose.model("Shortage", ShortageSchema);
