import mongoose from "mongoose";

const PumpSchema = new mongoose.Schema(
  {
    depot: { type: String, required: true, index: true },
    cmsCode: { type: String, required: true },
    roName: { type: String, required: true },
    rtkm: { type: Number, default: 0 },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    district: { type: String, default: "" },
    division: { type: String, default: "" },
    zone: { type: String, default: "" },
    sourceLocation: { type: String, default: "" },
    supplyLocationCode: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    geocoded: { type: Boolean, default: false },

    // Moderation: master data is "approved"; driver submissions start "pending".
    status: { type: String, enum: ["approved", "pending", "rejected"], default: "approved", index: true },
    submittedByName: { type: String, default: "" },
    submittedByPhone: { type: String, default: "" },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

PumpSchema.index({ depot: 1, cmsCode: 1 }, { unique: true });
PumpSchema.index({ roName: "text", cmsCode: "text" });
PumpSchema.index({ updatedAt: 1 });

export function toClient(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    depot: o.depot,
    cmsCode: o.cmsCode,
    roName: o.roName,
    rtkm: o.rtkm,
    address: o.address || "",
    city: o.city || "",
    state: o.state || "",
    district: o.district || "",
    division: o.division || "",
    zone: o.zone || "",
    sourceLocation: o.sourceLocation || "",
    supplyLocationCode: o.supplyLocationCode || "",
    lat: o.lat ?? null,
    lng: o.lng ?? null,
    geocoded: !!o.geocoded,
    status: o.status || "approved",
    submittedByName: o.submittedByName || "",
    submittedByPhone: o.submittedByPhone || "",
    rejectionReason: o.rejectionReason || "",
    isDeleted: !!o.isDeleted,
    updatedAt: o.updatedAt,
  };
}

export const Pump = mongoose.models.Pump || mongoose.model("Pump", PumpSchema);
