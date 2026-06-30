import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import {
  Transport, Load, Shortage, SalaryRecord, Settlement, Upload, Maintenance,
  Leave, ExtraOil, MeterReading, Notification, FastagTxn, FastagWalletTxn,
  Expense, RtkmRequest, Truck, User,
} from "@/lib/models";
import { requireAuth } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";

// POST /api/transports/:id/wipe  { includeFleet?: boolean }
// Owner self-service "fresh start": deletes all of THIS transport's transactional data
// (loads, shortages, salaries, settlements, uploads, FASTag, maintenance, leaves, extra oil,
// meter readings, notifications, RTKM requests). Master pumps and the owner account are never
// touched, and it's strictly scoped to a transport the caller owns — other owners are unaffected.
// includeFleet:true also removes this transport's trucks + driver/manager logins.
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner"] });
  if (!me) return unauth();
  await dbConnect();

  // Ownership gate — only the owner of THIS transport may wipe it.
  const tr = await Transport.findOne({ _id: params.id, ownerId: me.userId }).select("_id");
  if (!tr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tid = tr._id;
  const b = await request.json().catch(() => ({}));
  const includeFleet = !!b.includeFleet;

  const TXN = [
    ["loads", Load], ["shortages", Shortage], ["salaryRecords", SalaryRecord],
    ["settlements", Settlement], ["uploads", Upload], ["maintenance", Maintenance],
    ["leaves", Leave], ["extraOil", ExtraOil], ["meterReadings", MeterReading],
    ["notifications", Notification], ["fastagTxns", FastagTxn],
    ["fastagWalletTxns", FastagWalletTxn], ["expenses", Expense], ["rtkmRequests", RtkmRequest],
  ];

  const deleted = {};
  for (const [name, Model] of TXN) {
    const r = await Model.deleteMany({ transportId: tid });
    deleted[name] = r.deletedCount || 0;
  }

  if (includeFleet) {
    deleted.trucks = (await Truck.deleteMany({ transportId: tid })).deletedCount || 0;
    // Only this transport's members (drivers/managers) created by this owner — never the owner.
    deleted.members = (await User.deleteMany({
      transportId: tid, role: { $in: ["driver", "manager"] }, createdByOwnerId: me.userId,
    })).deletedCount || 0;
  }

  const total = Object.values(deleted).reduce((s, n) => s + n, 0);
  return NextResponse.json({ ok: true, includeFleet, total, deleted });
}
