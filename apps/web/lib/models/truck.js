import mongoose from "mongoose";

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
    createdAt: o.createdAt,
  };
}

export const Truck = mongoose.models.Truck || mongoose.model("Truck", TruckSchema);
