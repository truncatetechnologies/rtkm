/* Create (or update) a phone+PIN admin account.
 * Usage: node scripts/create-admin.js [phone] [pin] [name]
 *   defaults: phone 9000000000, name "Admin".
 *   For testing the password (pin) defaults to the SAME value as the phone number
 *   when not given, so `node scripts/create-admin.js 9876543210` => login 9876543210 / 9876543210.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const crypto = require("crypto");
const mongoose = require("mongoose");

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const phone = String(process.argv[2] || "9000000000").replace(/[^\d+]/g, "");
const pin = String(process.argv[3] || phone); // password defaults to the phone number (testing)
const name = process.argv[4] || "Admin";

const UserSchema = new mongoose.Schema(
  { role: String, name: String, phone: String, pinHash: String, status: String },
  { timestamps: true, strict: false }
);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await User.findOne({ phone });
  if (existing && existing.role !== "admin") {
    console.error(`Phone ${phone} is already used by a ${existing.role}. Pick a different phone.`);
    process.exit(1);
  }
  await User.findOneAndUpdate(
    { phone },
    { $set: { role: "admin", name, phone, pinHash: hashPin(pin), status: "active" } },
    { upsert: true }
  );
  console.log(`✓ Admin ready — login with phone ${phone} / PIN ${pin}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
