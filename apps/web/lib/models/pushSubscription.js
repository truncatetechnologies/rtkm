import mongoose from "mongoose";

// A device/browser registered to receive OS push for a transport.
//  - platform "expo": `token` holds the Expo push token (ExponentPushToken[...]).
//  - platform "web":  `subscription` holds the browser PushSubscription JSON.
const PushSubscriptionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    transportId: { type: mongoose.Schema.Types.ObjectId, ref: "Transport", default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    platform: { type: String, enum: ["expo", "web"], required: true },
    token: { type: String, default: "" },        // expo push token
    endpoint: { type: String, default: "" },      // web: dedupe key
    subscription: { type: Object, default: null }, // web: full PushSubscription
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ transportId: 1, platform: 1 });

export const PushSubscription =
  mongoose.models.PushSubscription || mongoose.model("PushSubscription", PushSubscriptionSchema);
