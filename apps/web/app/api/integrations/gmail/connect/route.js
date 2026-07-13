import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { signMobileToken } from "@/lib/mobileAuth";
import { gmailAuthUrl } from "@/lib/google/gmail";

export const dynamic = "force-dynamic";

// GET /api/integrations/gmail/connect?transportId=[&format=json][&platform=mobile]
// Web: redirects the owner to the Google consent screen.
// Mobile: called with a Bearer token + format=json → returns { url } so the app can open it in a
// browser. The shared callback then stores the token server-side and shows a "return to app" page.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  const mobile = searchParams.get("platform") === "mobile";
  // Where to land after consent (onboarding sends you back to the dashboard). Same-origin /app paths only.
  const nextRaw = searchParams.get("next") || "";
  const next = /^\/app(\/|$)/.test(nextRaw) ? nextRaw : "";
  const state = signMobileToken(
    { sub: scope.identity.userId, ownerId: scope.ownerId, transportId: scope.transportId, purpose: "gmail", mobile, next },
    600
  );
  const url = gmailAuthUrl(state);
  if (searchParams.get("format") === "json") return NextResponse.json({ url });
  return NextResponse.redirect(url);
}
