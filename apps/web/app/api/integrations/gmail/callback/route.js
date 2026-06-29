import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { verifyMobileToken } from "@/lib/mobileAuth";
import { exchangeCode, getUserEmail } from "@/lib/google/gmail";
import { encryptSecret } from "@/lib/crypto";

// GET /api/integrations/gmail/callback — Google redirects here after consent.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const base = process.env.NEXTAUTH_URL || origin;
  const back = (qs) => NextResponse.redirect(`${base}/app/settings?${qs}`);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (searchParams.get("error") || !code || !state) return back("gmail=error");

  const payload = verifyMobileToken(state);
  if (!payload || payload.purpose !== "gmail" || !payload.transportId) return back("gmail=error");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back("gmail=norefresh");
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
    return back("gmail=connected");
  } catch {
    return back("gmail=error");
  }
}
