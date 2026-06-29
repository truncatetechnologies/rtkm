import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email) return false;
  const list = adminEmails();
  return list.includes(String(email).toLowerCase());
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // Only allowlisted Gmail addresses may sign in.
    async signIn({ user }) {
      return isAdminEmail(user?.email);
    },
    async session({ session }) {
      if (session?.user) {
        session.user.isAdmin = isAdminEmail(session.user.email);
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/signin",
  },
};

export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdminEmail(session.user.email)) return null;
  return session;
}
