import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Pump, toClient } from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { pumpInputSchema } from "@rtkm/shared";

// GET /api/pumps?depot=&q=&page=&limit=
export async function GET(request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const depot = searchParams.get("depot");
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // Public + admin master list: only approved pumps (pending submissions live in /api/admin/submissions).
  const filter = { isDeleted: false, status: "approved" };
  if (depot) filter.depot = depot;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ roName: rx }, { cmsCode: rx }];
  }

  const [items, total] = await Promise.all([
    Pump.find(filter).sort({ roName: 1 }).skip((page - 1) * limit).limit(limit),
    Pump.countDocuments(filter),
  ]);

  return NextResponse.json({
    pumps: items.map(toClient),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

// POST /api/pumps  (admin)
export async function POST(request) {
  const admin = await requireAuth(request, { roles: ["admin"] });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const body = await request.json();
  const parsed = pumpInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  try {
    const created = await Pump.create({ ...data, isDeleted: false });
    return NextResponse.json({ pump: toClient(created) }, { status: 201 });
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json({ error: "A pump with this depot + CMS Code already exists" }, { status: 409 });
    }
    throw e;
  }
}
