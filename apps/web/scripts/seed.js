/* Seed MongoDB from the extracted live data in ../../data/*.json
 * Usage: npm run seed -w apps/web
 * Idempotent: upserts by (depot, cmsCode).
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { DEPOTS, normalizeAll } = require("@rtkm/shared");

const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");

const PumpSchema = new mongoose.Schema(
  {
    depot: { type: String, required: true, index: true },
    cmsCode: { type: String, required: true },
    roName: { type: String, required: true },
    rtkm: { type: Number, default: 0 },
    address: String, city: String, state: String, district: String,
    division: String, zone: String, sourceLocation: String, supplyLocationCode: String,
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    geocoded: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    status: { type: String, default: "approved" },
  },
  { timestamps: true }
);
PumpSchema.index({ depot: 1, cmsCode: 1 }, { unique: true });
const Pump = mongoose.models.Pump || mongoose.model("Pump", PumpSchema);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set (copy .env.local.example to .env.local)");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  let total = 0;
  for (const depot of DEPOTS) {
    const file = path.join(DATA_DIR, `${depot.slug}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`! missing ${file}, skipping`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const records = normalizeAll(raw, depot.slug);

    const ops = records.map((r) => ({
      updateOne: {
        filter: { depot: r.depot, cmsCode: r.cmsCode },
        // Only set source fields on insert; preserve admin-edited coords/rtkm on re-seed.
        update: {
          $setOnInsert: {
            lat: null, lng: null, geocoded: false, isDeleted: false, status: "approved",
          },
          $set: {
            roName: r.roName, rtkm: r.rtkm, address: r.address, city: r.city,
            state: r.state, district: r.district, division: r.division, zone: r.zone,
            sourceLocation: r.sourceLocation, supplyLocationCode: r.supplyLocationCode,
          },
        },
        upsert: true,
      },
    }));
    if (ops.length) {
      const res = await Pump.bulkWrite(ops, { ordered: false });
      const n = (res.upsertedCount || 0) + (res.modifiedCount || 0);
      total += records.length;
      console.log(`${depot.slug}: ${records.length} records (upserted ${res.upsertedCount || 0}, modified ${res.modifiedCount || 0})`);
    }
  }

  // Migration: backfill status on any pumps seeded before the moderation field existed.
  const migrated = await Pump.updateMany(
    { status: { $exists: false } },
    { $set: { status: "approved" } }
  );
  if (migrated.modifiedCount) console.log(`Backfilled status:approved on ${migrated.modifiedCount} existing pumps`);

  const count = await Pump.countDocuments();
  console.log(`Done. Source records processed: ${total}. Total pumps in DB: ${count}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
