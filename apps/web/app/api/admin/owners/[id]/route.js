import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { User, toUser } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";

// POST /api/admin/owners/:id  { action: "disable" | "enable" }
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["admin"] });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const { action } = await request.json();
  const status = action === "disable" ? "disabled" : action === "enable" ? "active" : null;
  if (!status) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const user = await User.findOneAndUpdate({ _id: params.id, role: "owner" }, { status }, { new: true });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ owner: toUser(user) });
}
