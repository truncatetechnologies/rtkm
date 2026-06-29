import { NextResponse } from "next/server";
import { verifyGoogleIdToken, signMobileToken } from "@/lib/mobileAuth";
import { isAdminEmail } from "@/lib/auth";

// POST /api/auth/mobile { idToken }
// Verifies a Google ID token from the Expo app and, if the email is an admin,
// returns a long-lived JWT the app sends as Bearer for admin API calls.
export async function POST(request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "idToken required" }, { status: 400 });

    const payload = await verifyGoogleIdToken(idToken);
    const email = payload?.email;
    if (!email) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const admin = isAdminEmail(email);
    const token = admin ? signMobileToken({ email, name: payload.name, role: "admin" }) : null;

    return NextResponse.json({
      email,
      name: payload.name || "",
      picture: payload.picture || "",
      isAdmin: admin,
      token,
    });
  } catch (e) {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }
}
