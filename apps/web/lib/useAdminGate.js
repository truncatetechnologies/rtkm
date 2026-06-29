"use client";
import { useEffect, useState } from "react";
import { useSession, signOut as nextSignOut } from "next-auth/react";

// Unifies the two ways an admin can be signed in to the /admin master-data area:
//   1) Google NextAuth session (allowlisted email)  — the original web admin.
//   2) Phone+PIN admin — a DB user with role "admin", authenticated via the owner
//      cookie set by /api/auth/owner/login. Lets the same tools be used after a
//      plain phone+password login (see /admin/signin and /login).
// Returns { loading, isAdmin, label, via, signOut }.
export function useAdminGate() {
  const { data: session, status } = useSession();
  const googleAdmin = session?.user?.isAdmin ? { label: session.user.email, via: "google" } : null;
  const [phoneAdmin, setPhoneAdmin] = useState(undefined); // undefined = checking, null = not a phone admin

  useEffect(() => {
    if (googleAdmin) { setPhoneAdmin(null); return; }
    if (status === "loading") return; // wait until NextAuth resolves before falling back
    let alive = true;
    fetch("/api/auth/owner/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => { if (alive) setPhoneAdmin(me && me.role === "admin" ? { label: me.name, via: "phone" } : null); })
      .catch(() => { if (alive) setPhoneAdmin(null); });
    return () => { alive = false; };
  }, [googleAdmin, status]);

  const admin = googleAdmin || phoneAdmin || null;
  const loading = status === "loading" || (!googleAdmin && phoneAdmin === undefined);

  async function signOut() {
    if (admin?.via === "phone") {
      await fetch("/api/auth/owner/logout", { method: "POST" }).catch(() => {});
      window.location.href = "/login";
    } else {
      nextSignOut({ callbackUrl: "/admin/signin" });
    }
  }

  return { loading, isAdmin: !!admin, label: admin?.label, via: admin?.via, signOut };
}
