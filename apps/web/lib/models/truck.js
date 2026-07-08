import mongoose from "mongoose";

// Snapshot of the vehicle's record pulled from the VAHAN / Parivahan portal (via a provider).
// Holds the government document expiry dates so the app can flag what's expired / expiring,
// plus the full raw payload so the owner can download the record.
const RcSchema = new mongoose.Schema(
  {
    fetchedAt: { type: Date, default: null },
    status: { type: String, enum: ["ok", "error", "never"], default: "never" },
    error: { type: String, default: "" },
    provider: { type: String, default: "" },
    // identity
    regNo: { type: String, default: "" },
    ownerName: { type: String, default: "" },
    makerModel: { type: String, default: "" },
    vehicleClass: { type: String, default: "" },
    fuel: { type: String, default: "" },
    regDate: { type: Date, default: null },
    chassis: { type: String, default: "" },
    engine: { type: String, default: "" },
    financer: { type: String, default: "" },
    rcStatus: { type: String, default: "" },
    // documents + expiry
    insurer: { type: String, default: "" },
    insurancePolicyNo: { type: String, default: "" },
    insuranceUpto: { type: Date, default: null },
    fitnessUpto: { type: Date, default: null },
    puccNo: { type: String, default: "" },
    puccUpto: { type: Date, default: null },
    permitNo: { type: String, default: "" },
    permitType: { type: String, default: "" },
    permitUpto: { type: Date, default: null },
    taxUpto: { type: Date, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, default: null }, // full provider payload (for download)
  },
  { _id: false }
);

const TruckSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    type: { type: String, enum: ["truck", "tanker"], default: "tanker" },
    name: { type: String, default: "" },
    registrationNo: { type: String, default: "" },
    capacity: { type: Number, default: 0 }, // litres (tanker) or tonnes (truck)
    averageKmL: { type: Number, default: 4 },
    assignedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: true },
    rc: { type: RcSchema, default: null },
  },
  { timestamps: true }
);

export function toTruck(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    ownerId: String(o.ownerId),
    transportId: o.transportId ? String(o.transportId) : null,
    type: o.type || "tanker",
    name: o.name || "",
    registrationNo: o.registrationNo || "",
    capacity: o.capacity || 0,
    averageKmL: o.averageKmL || 4,
    assignedDriverId: o.assignedDriverId ? String(o.assignedDriverId) : null,
    active: o.active !== false,
    rc: o.rc ? toRc(o.rc) : null,
    createdAt: o.createdAt,
  };
}

function toRc(r) {
  return {
    fetchedAt: r.fetchedAt || null,
    status: r.status || "never",
    error: r.error || "",
    provider: r.provider || "",
    regNo: r.regNo || "",
    ownerName: r.ownerName || "",
    makerModel: r.makerModel || "",
    vehicleClass: r.vehicleClass || "",
    fuel: r.fuel || "",
    regDate: r.regDate || null,
    chassis: r.chassis || "",
    engine: r.engine || "",
    financer: r.financer || "",
    rcStatus: r.rcStatus || "",
    insurer: r.insurer || "",
    insurancePolicyNo: r.insurancePolicyNo || "",
    insuranceUpto: r.insuranceUpto || null,
    fitnessUpto: r.fitnessUpto || null,
    puccNo: r.puccNo || "",
    puccUpto: r.puccUpto || null,
    permitNo: r.permitNo || "",
    permitType: r.permitType || "",
    permitUpto: r.permitUpto || null,
    taxUpto: r.taxUpto || null,
    raw: r.raw || null,
  };
}

export const Truck = mongoose.models.Truck || mongoose.model("Truck", TruckSchema);
