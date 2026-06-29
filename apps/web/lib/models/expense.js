import mongoose from "mongoose";

// General spend not captured by fuel(loads)/maintenance/salary.
const ExpenseSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    type: { type: String, default: "misc" }, // toll, fine, food, misc...
    amount: { type: Number, default: 0 },
    date: { type: Date, default: () => new Date() },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export function toExpense(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    transportId: o.transportId ? String(o.transportId) : null,
    type: o.type || "misc",
    amount: o.amount || 0,
    date: o.date,
    notes: o.notes || "",
    createdAt: o.createdAt,
  };
}

export const Expense = mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
