import mongoose from "mongoose";

// An odometer / meter reading captured by a driver (or entered manually by the transporter),
// attached to a specific trip/load. Optionally carries a photo of the meter.
const MeterReadingSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", default: null, index: true },
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },

    readingKm: { type: Number, default: 0 }, // the odometer count the driver typed in
    photoPath: { type: String, default: "" }, // relative path under uploads/ (the meter photo)
    photoFilename: { type: String, default: "" },
    source: { type: String, enum: ["driver", "transporter"], default: "driver" }, // who recorded it
    notes: { type: String, default: "" },
    recordedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

MeterReadingSchema.index({ transportId: 1, recordedAt: -1 });

export function toMeterReading(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    transportId: o.transportId ? String(o.transportId) : null,
    driverId: o.driverId ? String(o.driverId) : null,
    loadId: o.loadId ? String(o.loadId) : null,
    truckId: o.truckId ? String(o.truckId) : null,
    readingKm: o.readingKm || 0,
    hasPhoto: !!o.photoPath,
    source: o.source || "driver",
    notes: o.notes || "",
    recordedAt: o.recordedAt,
    createdAt: o.createdAt,
  };
}

export const MeterReading = mongoose.models.MeterReading || mongoose.model("MeterReading", MeterReadingSchema);
