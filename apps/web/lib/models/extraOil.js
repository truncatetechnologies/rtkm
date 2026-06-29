import mongoose from "mongoose";

// Extra diesel given to a driver mid-trip — over and above the RTKM-based plan — for a breakdown,
// route change, detour, etc. Logged so an owner can track which truck/driver asks for extra, how
// often and how much, and control it.
const ExtraOilSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },
    vehicleNo: { type: String, default: "" },   // denormalised reg (works even for an unregistered tanker)
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    driverName: { type: String, default: "" },  // denormalised so the log reads on its own
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", default: null }, // the delivery it's logged against
    invoiceNumber: { type: String, default: "" }, // denormalised invoice for display
    shipmentNo: { type: String, default: "" },  // the trip (shipment) it happened on
    litres: { type: Number, default: 0 },
    reason: { type: String, default: "other" }, // breakdown | route_change | route_issue | other
    notes: { type: String, default: "" },
    ratePerL: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    date: { type: Date, default: () => new Date() },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ExtraOilSchema.index({ transportId: 1, date: -1 });

export function toExtraOil(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    transportId: o.transportId ? String(o.transportId) : null,
    truckId: o.truckId ? String(o.truckId) : null,
    vehicleNo: o.vehicleNo || "",
    driverId: o.driverId ? String(o.driverId) : null,
    driverName: o.driverName || "",
    loadId: o.loadId ? String(o.loadId) : null,
    invoiceNumber: o.invoiceNumber || "",
    shipmentNo: o.shipmentNo || "",
    litres: o.litres || 0,
    reason: o.reason || "other",
    notes: o.notes || "",
    ratePerL: o.ratePerL || 0,
    cost: o.cost || 0,
    date: o.date,
    createdAt: o.createdAt,
  };
}

export const ExtraOil = mongoose.models.ExtraOil || mongoose.model("ExtraOil", ExtraOilSchema);
