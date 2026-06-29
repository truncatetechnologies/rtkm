import { OWNER_COOKIE } from "@/lib/auth/session";

// Apply the owner auth cookie to a NextResponse.
export function setOwnerCookie(res, token) {
  res.cookies.set(OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export function clearOwnerCookie(res) {
  res.cookies.set(OWNER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
