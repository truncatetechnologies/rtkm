import mongoose from "mongoose";

// A vehicle-document expiry alert, parsed from the oil company's "document expiring" email.
// e.g. Nayara: "UP65JT1083 | National/State Road permit Certificate | 15-07-2026".
const VehicleAlertSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", required: true, index: true },
    vehicleNo: { type: String, default: "" },
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },
    certificate: { type: String, default: "" }, // e.g. "National/ State Road permit Certificate"
    expiryDate: { type: Date, default: null },
    company: { type: String, default: "" }, // nayara | bpcl | hpcl | ioc
    receivedAt: { type: Date, default: null }, // email time
    messageId: { type: String, default: "" },
    subject: { type: String, default: "" },
  },
  { timestamps: true }
);
// One email can list several vehicles/certs, so dedup on the full tuple.
VehicleAlertSchema.index({ transportId: 1, messageId: 1, vehicleNo: 1, certificate: 1 }, { unique: true, partialFilterExpression: { messageId: { $type: "string", $ne: "" } } });

export function toVehicleAlert(o) {
  o = o.toObject ? o.toObject() : o;
  return {
    id: String(o._id), vehicleNo: o.vehicleNo || "", certificate: o.certificate || "",
    expiryDate: o.expiryDate, company: o.company || "", receivedAt: o.receivedAt, subject: o.subject || "",
  };
}

export const VehicleAlert = mongoose.models.VehicleAlert || mongoose.model("VehicleAlert", VehicleAlertSchema);
