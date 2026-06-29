import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { generatePayslip } from "@/lib/services/salary";

// POST /api/salary/generate { transportId, driverId, period:"YYYY-MM", additions? } (owner)
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner"], transportId: b.transportId });
  if (scope.error) return scope.error;
  try {
    const slip = await generatePayslip({
      ownerId: scope.ownerId,
      transportId: scope.transportId,
      driverId: b.driverId,
      period: b.period,
      additions: b.additions || [],
    });
    return NextResponse.json({ payslip: slip }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 400 });
  }
}
