import fs from "fs/promises";
import path from "path";
import { dbConnect } from "@/lib/mongoose";
import { MeterReading, Load } from "@/lib/models";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Persist a meter photo under uploads/{transportId}/meter/ and return its relative path.
async function savePhoto(transportId, file) {
  if (!file || typeof file === "string") return { photoPath: "", photoFilename: "" };
  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(UPLOAD_DIR, String(transportId), "meter");
  await fs.mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}-${String(file.name || "meter.jpg").replace(/[^\w.\-]/g, "_")}`;
  await fs.writeFile(path.join(dir, safeName), buffer);
  return { photoPath: path.join(String(transportId), "meter", safeName), photoFilename: file.name || safeName };
}

// Create a meter reading attached to a load. `scope` is the resolved transport scope.
// `driverId` defaults to the load's driver; `source` is "driver" or "transporter".
export async function createMeterReading({ scope, loadId, readingKm, notes, source, file, driverId }) {
  await dbConnect();
  const load = await Load.findOne({ _id: loadId, transportId: scope.transportId }).select("_id driverId truckId");
  if (!load) return { error: "Trip not found" };

  const { photoPath, photoFilename } = await savePhoto(scope.transportId, file);
  const reading = await MeterReading.create({
    ownerId: scope.ownerId,
    transportId: scope.transportId,
    driverId: driverId || (load.driverId ? String(load.driverId) : null),
    loadId: String(load._id),
    truckId: load.truckId ? String(load.truckId) : null,
    readingKm: Number(readingKm) || 0,
    photoPath,
    photoFilename,
    source: source === "transporter" ? "transporter" : "driver",
    notes: String(notes || "").trim(),
  });
  return { reading };
}

// Read a stored meter photo's bytes for the serve route.
export async function readMeterPhoto(reading) {
  if (!reading?.photoPath) return null;
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, reading.photoPath));
    const ext = path.extname(reading.photoPath).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return { buf, type };
  } catch {
    return null;
  }
}
