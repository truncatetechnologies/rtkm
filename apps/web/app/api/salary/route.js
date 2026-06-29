import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { SalaryRecord, toSalary } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/salary?transportId=&driverId=&period= (owner/manager)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const filter = { transportId: scope.transportId };
  if (searchParams.get("driverId")) filter.driverId = searchParams.get("driverId");
  if (searchParams.get("period")) filter.period = searchParams.get("period");
  const slips = await SalaryRecord.find(filter).sort({ period: -1 }).limit(500);
  return NextResponse.json({ payslips: slips.map(toSalary) });
}
