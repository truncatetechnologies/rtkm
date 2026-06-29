import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { User, toUser } from "@/lib/models";
import { hashPin } from "@/lib/auth/pin";
import { signMobileToken } from "@/lib/mobileAuth";
import { setOwnerCookie } from "@/lib/ownerCookie";

function normPhone(p) {
  return String(p || "").replace(/[^\d+]/g, "");
}

// POST /api/auth/owner/register { name, phone, pin }
export async function POST(request) {
  await dbConnect();
  const { name, phone, pin } = await request.json();
  const ph = normPhone(phone);

  if (!name || !name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (ph.length < 7) return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  if (!/^\d{4,6}$/.test(String(pin || ""))) {
    return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
  }

  const existing = await User.findOne({ phone: ph });
  if (existing) return NextResponse.json({ error: "Phone already registered. Please log in." }, { status: 409 });

  const user = await User.create({
    role: "owner",
    name: name.trim(),
    phone: ph,
    pinHash: hashPin(pin),
    status: "active",
  });

  const token = signMobileToken({ sub: String(user._id), role: "owner", name: user.name });
  const res = NextResponse.json({ token, user: toUser(user) }, { status: 201 });
  return setOwnerCookie(res, token);
}
