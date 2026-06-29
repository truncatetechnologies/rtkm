import mongoose from "mongoose";

// A transport business / fleet. An owner can run several.
const TransportSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, default: "" },
    gstNo: { type: String, default: "" },
    phone: { type: String, default: "" },
    active: { type: Boolean, default: true },
    // Tanker fuel average (km per litre of diesel). Drives the per-shipment oil given to drivers.
    tankerAvg: { type: Number, default: 4.5 },
    // Diesel price (₹ per litre) — turns the diesel given to drivers into a real cost for spend/profit.
    dieselPrice: { type: Number, default: 0 },
    // Meal allowance — a flat amount (₹) the owner gives the driver per TRIP (shipment) for food/team
    // etc., on top of diesel & salary. Default applied per shipment; editable per trip.
    mealAllowancePerTrip: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export function toTransport(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    ownerId: String(o.ownerId),
    name: o.name,
    address: o.address || "",
    gstNo: o.gstNo || "",
    phone: o.phone || "",
    active: o.active !== false,
    tankerAvg: o.tankerAvg || 4.5,
    dieselPrice: o.dieselPrice || 0,
    mealAllowancePerTrip: o.mealAllowancePerTrip || 0,
    createdAt: o.createdAt,
  };
}

export const Transport = mongoose.models.Transport || mongoose.model("Transport", TransportSchema);
