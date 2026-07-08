import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { verifyMobileToken } from "@/lib/mobileAuth";
import { exchangeCode, getUserEmail } from "@/lib/google/gmail";
import { encryptSecret } from "@/lib/crypto";

// OAuth redirect that hits the DB — must run at request time, never statically prerendered.
export const dynamic = "force-dynamic";

// Minimal HTML shown to the in-app browser after the mobile OAuth flow (there's no web session
// there, so redirecting to /app/settings would just show a login screen).
function mobilePage(ok, msg) {
  const icon = ok ? "✓" : "✕";
  const color = ok ? "#34d399" : "#f87171";
  const title = ok ? "Gmail connected" : "Couldn't connect Gmail";
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0b1120;color:#e7ebf5;display:grid;place-items:center;min-height:100vh"><div style="text-align:center;padding:28px;max-width:320px"><div style="width:64px;height:64px;border-radius:50%;background:${color};color:#0b1120;font-size:34px;font-weight:800;display:grid;place-items:center;margin:0 auto 18px">${icon}</div><h2 style="margin:0 0 8px;font-size:20px">${title}</h2><p style="margin:0;color:#9aa4bc;line-height:1.5">${msg}</p></div></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

// GET /api/integrations/gmail/callback — Google redirects here after consent.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const base = process.env.NEXTAUTH_URL || origin;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const payload = state ? verifyMobileToken(state) : null;
  const isMobile = !!(payload && payload.mobile);

  // Finish for either surface: mobile → HTML page, web → redirect to Settings with a status flag.
  const done = (ok, reason) =>
    isMobile
      ? mobilePage(ok, ok ? "You're all set — close this window and return to the RTKM app." : "Please try again from the app.")
      : NextResponse.redirect(`${base}/app/settings?gmail=${ok ? "connected" : reason}`);

  if (searchParams.get("error") || !code || !payload || payload.purpose !== "gmail" || !payload.transportId) return done(false, "error");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return done(false, "norefresh");
    const email = await getUserEmail(tokens.access_token).catch(() => "");
    await dbConnect();
    await GmailConnection.findOneAndUpdate(
      { transportId: payload.transportId },
      {
        ownerId: payload.ownerId,
        transportId: payload.transportId,
        email,
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        connectedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return done(true);
  } catch {
    return done(false, "error");
  }
}
