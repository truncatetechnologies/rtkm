import mongoose from "mongoose";

// A depot "Gate In" (or Gate Out) event for a tanker, parsed from the oil company's
// notification email (Nayara / BPCL / HPCL / IOC). No PDF — the email body is the source.
const GateInSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", required: true, index: true },
    vehicleNo: { type: String, default: "" }, // TT number, normalized (no spaces, upper)
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },
    depot: { type: String, default: "" }, // e.g. "Nayara kanpur"
    company: { type: String, default: "" }, // nayara | bpcl | hpcl | ioc
    direction: { type: String, enum: ["in", "out"], default: "in" },
    gateAt: { type: Date, default: null }, // email received time
    messageId: { type: String, default: "" }, // Gmail message id (dedup)
    subject: { type: String, default: "" },
    snippet: { type: String, default: "" },
  },
  { timestamps: true }
);
GateInSchema.index({ transportId: 1, messageId: 1 }, { unique: true, partialFilterExpression: { messageId: { $type: "string", $ne: "" } } });

export function toGateIn(o) {
  o = o.toObject ? o.toObject() : o;
  return {
    id: String(o._id), vehicleNo: o.vehicleNo || "", depot: o.depot || "", company: o.company || "",
    direction: o.direction || "in", gateAt: o.gateAt, subject: o.subject || "", snippet: o.snippet || "",
  };
}

export const GateIn = mongoose.models.GateIn || mongoose.model("GateIn", GateInSchema);
