import mongoose from "mongoose";

// A driver leave entry — the "leave log". Dates are stored anchored to UTC noon (like the rest of
// the app) so whole-day counts are timezone-safe. Unpaid leaves pro-rate the monthly salary; paid
// leaves are kept in the log for record but don't reduce pay.
const LeaveSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true }, // inclusive; a single-day leave has fromDate == toDate
    paid: { type: Boolean, default: false }, // unpaid by default — unpaid days cut the salary
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

// Whole-day midnight UTC anchor for a date (drops the time-of-day).
export function dayUTC(d) {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

// Inclusive whole-day count between two dates (1 for a single day).
export function leaveDaysBetween(from, to) {
  return Math.max(0, Math.round((dayUTC(to) - dayUTC(from)) / 86400000) + 1);
}

export function toLeave(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    driverId: String(o.driverId),
    fromDate: o.fromDate,
    toDate: o.toDate,
    paid: !!o.paid,
    reason: o.reason || "",
    days: leaveDaysBetween(o.fromDate, o.toDate),
  };
}

export const Leave = mongoose.models.Leave || mongoose.model("Leave", LeaveSchema);
