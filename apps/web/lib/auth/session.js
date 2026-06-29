import { cookies } from "next/headers";
import { getAdminSession, isAdminEmail } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobileAuth";
import { dbConnect } from "@/lib/mongoose";
import { User, Transport } from "@/lib/models";

export const OWNER_COOKIE = "rtkm_token";
const MEMBER_ROLES = ["owner", "manager", "driver"];

function allow(identity, roles) {
  if (!identity || !identity.role) return null;
  if (roles && roles.length && !roles.includes(identity.role)) return null;
  return identity;
}

// Resolve caller from (1) NextAuth admin session, (2) Bearer JWT, (3) owner cookie.
// Returns { userId, role, name, transportId, ownerId } or null.
// `ownerId` is the owning account used to scope data (= userId for owners,
// = createdByOwnerId for managers/drivers).
export async function requireAuth(request, { roles } = {}) {
  const adminSession = await getAdminSession();
  if (adminSession) {
    return allow(
      { userId: null, role: "admin", name: adminSession.user.name, email: adminSession.user.email, transportId: null, ownerId: null },
      roles
    );
  }

  let token = null;
  const authz = request.headers.get("authorization") || "";
  if (authz.startsWith("Bearer ")) token = authz.slice(7);
  if (!token) token = cookies().get(OWNER_COOKIE)?.value || null;
  if (!token) return null;

  const payload = verifyMobileToken(token);
  if (!payload) return null;

  if (payload.role === "admin") {
    // Phone+PIN admin: a DB user with role "admin".
    if (payload.sub) {
      await dbConnect();
      const u = await User.findById(payload.sub).select("role status name");
      if (u && u.status === "active" && u.role === "admin") {
        return allow({ userId: String(u._id), role: "admin", name: u.name, transportId: null, ownerId: null }, roles);
      }
      return null;
    }
    // Google admin (JWT carrying an allowlisted email).
    if (!isAdminEmail(payload.email)) return null;
    return allow({ userId: null, role: "admin", name: payload.name, email: payload.email, transportId: null, ownerId: null }, roles);
  }

  if (MEMBER_ROLES.includes(payload.role) && payload.sub) {
    await dbConnect();
    const u = await User.findById(payload.sub).select("role status name transportId createdByOwnerId assignedTruckId appAccessEnabled");
    if (!u || u.status !== "active" || !MEMBER_ROLES.includes(u.role)) return null;
    // Revoke a driver's session the moment app access is turned off.
    if (u.role === "driver" && !u.appAccessEnabled) return null;
    return allow(
      {
        userId: String(u._id),
        role: u.role,
        name: u.name,
        transportId: u.transportId ? String(u.transportId) : null,
        ownerId: u.role === "owner" ? String(u._id) : (u.createdByOwnerId ? String(u.createdByOwnerId) : null),
        assignedTruckId: u.assignedTruckId ? String(u.assignedTruckId) : null,
      },
      roles
    );
  }

  return null;
}

// True if `identity` may act on `transportId`.
export async function canAccessTransport(identity, transportId) {
  if (!identity || !transportId) return false;
  if (identity.role === "admin") return true;
  if (identity.role === "owner") {
    await dbConnect();
    const tr = await Transport.findOne({ _id: transportId, ownerId: identity.userId }).select("_id");
    return !!tr;
  }
  // manager/driver: must be their transport
  return identity.transportId === String(transportId);
}
