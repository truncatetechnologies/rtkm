import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Pump } from "@/lib/models";
import { depotSlugs } from "@rtkm/shared";

// POST /api/submissions  (NO auth — drivers)
// Creates a pump in "pending" status; admin must approve before it goes public.
export async function POST(request) {
  await dbConnect();
  const body = await request.json();
  const depot = String(body.depot || "");
  const roName = String(body.roName || "").trim();
  const cmsCode = String(body.cmsCode || "").trim();
  const rtkm = Number(body.rtkm);

  if (!depotSlugs.includes(depot)) return NextResponse.json({ error: "Choose a depot" }, { status: 400 });
  if (!roName) return NextResponse.json({ error: "Pump name is required" }, { status: 400 });
  if (!cmsCode) return NextResponse.json({ error: "CMS code is required" }, { status: 400 });
  if (!isFinite(rtkm) || rtkm < 0) return NextResponse.json({ error: "Enter a valid RTKM" }, { status: 400 });

  // If this depot+code already exists (approved or pending), don't create a duplicate.
  const existing = await Pump.findOne({ depot, cmsCode });
  if (existing) {
    return NextResponse.json(
      { error: "This pump already exists or is awaiting approval." },
      { status: 409 }
    );
  }

  await Pump.create({
    depot,
    cmsCode,
    roName,
    rtkm,
    address: String(body.address || "").trim(),
    city: String(body.city || "").trim(),
    lat: body.lat == null || body.lat === "" ? null : Number(body.lat),
    lng: body.lng == null || body.lng === "" ? null : Number(body.lng),
    status: "pending",
    submittedByName: String(body.submittedByName || "").trim(),
    submittedByPhone: String(body.submittedByPhone || "").trim(),
  });

  return NextResponse.json(
    { ok: true, message: "Thanks! Your pump was submitted and is pending admin approval." },
    { status: 201 }
  );
}
