import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["admin", "owner", "manager", "driver"], required: true, index: true },
    name: { type: String, default: "" },
    // Phone+PIN login for owner / manager / driver.
    phone: { type: String },
    pinHash: { type: String, default: "" },
    // Admins come from Google (email allowlist).
    email: { type: String },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    // Driver app/web login permission. Off by default — the owner/transporter must
    // grant access in the driver's settings before the driver can log in.
    appAccessEnabled: { type: Boolean, default: false },

    // Managers + drivers belong to one transport; owners own many (see Transport.ownerId).
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    createdByOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Driver-specific
    assignedTruckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },
    salaryType: { type: String, enum: ["monthly", "per_trip"], default: "monthly" },
    baseSalary: { type: Number, default: 0 },
    shortageRatePerUnit: { type: Number, default: 0 }, // ₹ deducted per litre of shortage
    licenseNo: { type: String, default: "" },
    // Date the driver joined. Used to pro-rate the joining month's salary (a driver who starts
    // mid-month is paid only for the days from this date to month-end).
    joiningDate: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });

export function toUser(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    role: o.role,
    name: o.name || "",
    phone: o.phone || "",
    email: o.email || "",
    status: o.status || "active",
    appAccessEnabled: !!o.appAccessEnabled,
    transportId: o.transportId ? String(o.transportId) : null,
    assignedTruckId: o.assignedTruckId ? String(o.assignedTruckId) : null,
    salaryType: o.salaryType || "monthly",
    baseSalary: o.baseSalary || 0,
    shortageRatePerUnit: o.shortageRatePerUnit || 0,
    licenseNo: o.licenseNo || "",
    joiningDate: o.joiningDate || null,
    createdAt: o.createdAt,
  };
}

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
