import mongoose from "mongoose";

const MaintenanceSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },
    date: { type: Date, default: () => new Date() },
    category: { type: String, default: "" }, // tyre, engine, service, etc.
    description: { type: String, default: "" },
    cost: { type: Number, default: 0 },
    vendor: { type: String, default: "" },
    odometer: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MaintenanceSchema.index({ transportId: 1, date: -1 });

export function toMaintenance(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    transportId: o.transportId ? String(o.transportId) : null,
    truckId: o.truckId ? String(o.truckId) : null,
    date: o.date,
    category: o.category || "",
    description: o.description || "",
    cost: o.cost || 0,
    vendor: o.vendor || "",
    odometer: o.odometer || 0,
    createdAt: o.createdAt,
  };
}

export const Maintenance = mongoose.models.Maintenance || mongoose.model("Maintenance", MaintenanceSchema);
