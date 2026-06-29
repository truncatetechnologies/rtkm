import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { isAdminEmail, getAdminSession } from "@/lib/auth";

// ---- Minimal HS256 JWT (no extra deps) for the mobile admin token ----
function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signMobileToken(payload, expiresInSec = 60 * 60 * 24 * 30) {
  const secret = process.env.MOBILE_JWT_SECRET || "dev-secret";
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${sig}`;
}

export function verifyMobileToken(token) {
  try {
    const secret = process.env.MOBILE_JWT_SECRET || "dev-secret";
    const [h, p, s] = token.split(".");
    const data = `${h}.${p}`;
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    if (expected !== s) return null;
    const payload = JSON.parse(Buffer.from(p, "base64").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Verify a Google ID token coming from the Expo app.
export async function verifyGoogleIdToken(idToken) {
  const audiences = (process.env.GOOGLE_MOBILE_CLIENT_IDS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences.length ? audiences : undefined,
  });
  return ticket.getPayload(); // { email, name, picture, ... }
}

// Accept either a NextAuth admin session (web) OR a mobile bearer token.
export async function requireAdmin(request) {
  const session = await getAdminSession();
  if (session) return { email: session.user.email, via: "session" };

  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const payload = verifyMobileToken(auth.slice(7));
    if (payload && isAdminEmail(payload.email)) {
      return { email: payload.email, via: "mobile" };
    }
  }
  return null;
}
