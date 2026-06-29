import crypto from "crypto";

// AES-256-GCM at-rest encryption for secrets (Gmail refresh tokens).
const keyMaterial = process.env.GMAIL_TOKEN_SECRET || process.env.MOBILE_JWT_SECRET || "dev-secret-change-me";
const KEY = crypto.createHash("sha256").update(keyMaterial).digest();

export function encryptSecret(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function decryptSecret(b64) {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
