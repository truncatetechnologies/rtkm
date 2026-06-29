import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { User, toUser } from "@/lib/models";
import { verifyPin } from "@/lib/auth/pin";
import { signMobileToken } from "@/lib/mobileAuth";
import { setOwnerCookie } from "@/lib/ownerCookie";

function normPhone(p) {
  return String(p || "").replace(/[^\d+]/g, "");
}

// POST /api/auth/owner/login { phone, pin }
// Works for any phone+PIN role: owner, manager, driver.
export async function POST(request) {
  await dbConnect();
  const { phone, pin } = await request.json();
  const ph = normPhone(phone);

  const user = await User.findOne({ phone: ph, role: { $in: ["owner", "manager", "driver", "admin"] } });
  if (!user || !verifyPin(pin, user.pinHash)) {
    return NextResponse.json({ error: "Invalid phone or PIN" }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "Account disabled. Contact admin." }, { status: 403 });
  }
  // Drivers can only log in once the owner/transporter has enabled app access.
  if (user.role === "driver" && !user.appAccessEnabled) {
    return NextResponse.json({ error: "App access is turned off for your account. Ask your transporter to enable login." }, { status: 403 });
  }

  const token = signMobileToken({ sub: String(user._id), role: user.role, name: user.name });
  const res = NextResponse.json({ token, user: toUser(user) });
  return setOwnerCookie(res, token);
}
