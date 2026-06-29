import mongoose from "mongoose";

// A "load" = a tanker trip/consignment, optionally created from an oil-company invoice PDF.
const LoadSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", default: null },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    driverName: { type: String, default: "" }, // driver name from the invoice PDF (when not a registered driver)

    // Invoice / dispatch details (from the company PDF)
    company: { type: String, default: "" }, // nayara | bpcl | ioc | hpcl
    invoiceNumber: { type: String, default: "", index: true },
    invoiceDate: { type: Date, default: null },
    fromLocation: { type: String, default: "" },
    toLocation: { type: String, default: "" },
    pumpCode: { type: String, default: "" },
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null },
    roName: { type: String, default: "" },
    cmsCode: { type: String, default: "" },
    vehicleNo: { type: String, default: "" }, // raw tanker reg from the PDF (even if not a registered Truck)
    product: { type: String, default: "" }, // MS / HSD etc.

    // Quantities (litres) + shortage
    loadQtyL: { type: Number, default: 0 }, // dispatched
    deliveredQtyL: { type: Number, default: 0 }, // received at pump
    shortageL: { type: Number, default: 0 }, // loadQty - delivered (also set from shortage PDF)

    // Fuel/RTKM economics (kept from v2)
    rtkm: { type: Number, default: 0 },
    averageKmL: { type: Number, default: 4.5 },
    oilLiters: { type: Number, default: 0 }, // diesel for this load's share (0 on non-lead shipment members → totals don't double-count)
    ratePerL: { type: Number, default: 0 },
    oilCost: { type: Number, default: 0 },

    // Shipment clubbing: many pumps can share one Shipment No. Oil is given ONCE per shipment,
    // based on the farthest pump (max RTKM), not per pump. These are recomputed across the shipment.
    shipmentMaxRtkm: { type: Number, default: 0 }, // longest RTKM among loads in this shipment
    shipmentOilLiters: { type: Number, default: 0 }, // diesel given to the driver for the whole shipment
    shipmentLead: { type: Boolean, default: true }, // one load per shipment carries the oil/cost for totals

    // Meal allowance — flat per-trip amount carried on the lead load (0 on non-lead members so totals
    // never double-count). Defaults to Transport.mealAllowancePerTrip; mealAllowanceManual pins an override.
    mealAllowance: { type: Number, default: 0 },
    mealAllowanceManual: { type: Boolean, default: false },

    hasInvoice: { type: Boolean, default: false }, // true once the source Tax Invoice PDF was uploaded
    loadDate: { type: Date, default: () => new Date() },
    status: { type: String, enum: ["planned", "completed"], default: "completed" },
    notes: { type: String, default: "" },
    sourcePdfId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", default: null },

    // Freight statement (what the company pays the transporter)
    shipmentNo: { type: String, default: "", index: true },
    deliveryDocument: { type: String, default: "" },
    supplyLocation: { type: String, default: "" },
    lrNumber: { type: String, default: "" },
    freightRate: { type: Number, default: 0 },
    freightAmount: { type: Number, default: 0 }, // gross freight earned (estimated/charged)

    // Settlement (from bank payment advice)
    tdsAmount: { type: Number, default: 0 },
    nayaraShortageDeduction: { type: Number, default: 0 }, // amount company cut for shortage
    otherDeduction: { type: Number, default: 0 },
    netReceived: { type: Number, default: 0 },
    settlementStatus: { type: String, enum: ["pending", "settled"], default: "pending", index: true },
    paymentRef: { type: String, default: "" },
    paidDate: { type: Date, default: null },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement", default: null },
  },
  { timestamps: true }
);

LoadSchema.index({ transportId: 1, loadDate: -1 });
LoadSchema.index({ transportId: 1, invoiceNumber: 1 });

export function toLoad(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    ownerId: String(o.ownerId),
    transportId: o.transportId ? String(o.transportId) : null,
    truckId: o.truckId ? String(o.truckId) : null,
    driverId: o.driverId ? String(o.driverId) : null,
    driverName: o.driverName || "",
    company: o.company || "",
    invoiceNumber: o.invoiceNumber || "",
    invoiceDate: o.invoiceDate,
    fromLocation: o.fromLocation || "",
    toLocation: o.toLocation || "",
    pumpCode: o.pumpCode || "",
    pumpId: o.pumpId ? String(o.pumpId) : null,
    roName: o.roName || "",
    cmsCode: o.cmsCode || "",
    vehicleNo: o.vehicleNo || "",
    product: o.product || "",
    loadQtyL: o.loadQtyL || 0,
    deliveredQtyL: o.deliveredQtyL || 0,
    shortageL: o.shortageL || 0,
    rtkm: o.rtkm || 0,
    averageKmL: o.averageKmL || 4.5,
    oilLiters: o.oilLiters || 0,
    ratePerL: o.ratePerL || 0,
    oilCost: o.oilCost || 0,
    shipmentMaxRtkm: o.shipmentMaxRtkm || 0,
    shipmentOilLiters: o.shipmentOilLiters || 0,
    shipmentLead: o.shipmentLead !== false,
    mealAllowance: o.mealAllowance || 0,
    mealAllowanceManual: !!o.mealAllowanceManual,
    loadDate: o.loadDate,
    status: o.status || "completed",
    notes: o.notes || "",
    sourcePdfId: o.sourcePdfId ? String(o.sourcePdfId) : null,
    shipmentNo: o.shipmentNo || "",
    deliveryDocument: o.deliveryDocument || "",
    supplyLocation: o.supplyLocation || "",
    lrNumber: o.lrNumber || "",
    freightRate: o.freightRate || 0,
    freightAmount: o.freightAmount || 0,
    tdsAmount: o.tdsAmount || 0,
    nayaraShortageDeduction: o.nayaraShortageDeduction || 0,
    otherDeduction: o.otherDeduction || 0,
    netReceived: o.netReceived || 0,
    settlementStatus: o.settlementStatus || "pending",
    hasInvoice: !!o.hasInvoice,
    paymentRef: o.paymentRef || "",
    paidDate: o.paidDate,
    createdAt: o.createdAt,
  };
}

export const Load = mongoose.models.Load || mongoose.model("Load", LoadSchema);
