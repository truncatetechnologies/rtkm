import mongoose from "mongoose";

const LineSchema = new mongoose.Schema(
  {
    reason: String,
    amount: Number,
    shortageId: { type: mongoose.Schema.Types.ObjectId, ref: "Shortage", default: null },
  },
  { _id: false }
);

// A monthly payslip for a driver.
const SalaryRecordSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    period: { type: String, required: true }, // "YYYY-MM"
    // baseSalary = the PRO-RATED base actually paid this month (monthlySalary ÷ daysInMonth × payableDays).
    // It feeds netPay. The fields below explain how it was derived for a transparent payslip.
    baseSalary: { type: Number, default: 0 },
    monthlySalary: { type: Number, default: 0 }, // the driver's full monthly salary (reference)
    daysInMonth: { type: Number, default: 0 },   // calendar days in the period (28–31)
    payableDays: { type: Number, default: 0 },   // days actually paid (employed − unpaid leave)
    leaveDays: { type: Number, default: 0 },      // unpaid leave days deducted this month
    additions: { type: [LineSchema], default: [] },
    deductions: { type: [LineSchema], default: [] },
    netPay: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "paid"], default: "draft" },
    generatedAt: { type: Date, default: () => new Date() },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SalaryRecordSchema.index({ driverId: 1, period: 1 }, { unique: true });

export function toSalary(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    transportId: o.transportId ? String(o.transportId) : null,
    driverId: String(o.driverId),
    period: o.period,
    baseSalary: o.baseSalary || 0,
    monthlySalary: o.monthlySalary || 0,
    daysInMonth: o.daysInMonth || 0,
    payableDays: o.payableDays || 0,
    leaveDays: o.leaveDays || 0,
    additions: (o.additions || []).map((l) => ({ reason: l.reason, amount: l.amount })),
    deductions: (o.deductions || []).map((l) => ({ reason: l.reason, amount: l.amount, shortageId: l.shortageId ? String(l.shortageId) : null })),
    netPay: o.netPay || 0,
    status: o.status || "draft",
    generatedAt: o.generatedAt,
    paidAt: o.paidAt,
  };
}

export const SalaryRecord = mongoose.models.SalaryRecord || mongoose.model("SalaryRecord", SalaryRecordSchema);
