import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { signMobileToken } from "@/lib/mobileAuth";
import { gmailAuthUrl } from "@/lib/google/gmail";

// GET /api/integrations/gmail/connect?transportId= → redirect owner to Google consent.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  const state = signMobileToken(
    { sub: scope.identity.userId, ownerId: scope.ownerId, transportId: scope.transportId, purpose: "gmail" },
    600
  );
  return NextResponse.redirect(gmailAuthUrl(state));
}
