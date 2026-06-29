import mongoose from "mongoose";

// A stored PDF (invoice or shortage report) + its parsed fields.
const UploadSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    kind: { type: String, enum: ["invoice", "shortage", "freight", "payment", "ledger", "fastag-boss", "fastag-tag"], default: "invoice" },
    company: { type: String, default: "" },
    hash: { type: String, default: "", index: true }, // sha256 of the file bytes (duplicate detection)
    filename: { type: String, default: "" },
    path: { type: String, default: "" }, // relative path under uploads/
    parsedJson: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["parsed", "needs_review", "linked"], default: "needs_review" },
    source: { type: String, enum: ["upload", "gmail"], default: "upload" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Change-set this upload produced (used to revert/undo it).
    summary: { type: String, default: "" },
    createdLoadIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    createdShortageIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    affectedLoadIds: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // settlement touched these
    settlementRef: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement", default: null },
    reverted: { type: Boolean, default: false },
    revertedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export function toUpload(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    transportId: o.transportId ? String(o.transportId) : null,
    kind: o.kind,
    company: o.company || "",
    filename: o.filename || "",
    status: o.status,
    summary: o.summary || "",
    createdCount: (o.createdLoadIds || []).length,
    affectedCount: (o.affectedLoadIds || []).length,
    reverted: !!o.reverted,
    revertedAt: o.revertedAt,
    createdAt: o.createdAt,
  };
}

export const Upload = mongoose.models.Upload || mongoose.model("Upload", UploadSchema);
