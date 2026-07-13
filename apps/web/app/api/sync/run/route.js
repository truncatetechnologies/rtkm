import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { runSync, daysForPeriod, PAGE_KINDS, ALL_KINDS } from "@/lib/services/syncAll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/sync/run { transportId, page?, kinds?, period? }
// Manual "pull anything I'm missing" for a page. `page` picks the right kinds; `period` is
// today | week | month. Used by the Sync control on every screen (web + mobile).
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;

  const kinds = Array.isArray(b.kinds) && b.kinds.length
    ? b.kinds.filter((k) => ALL_KINDS.includes(k))
    : (PAGE_KINDS[b.page] || ALL_KINDS);
  const days = daysForPeriod(b.period);

  try {
    const result = await runSync({ scope, kinds, days });
    return NextResponse.json({ ok: true, period: b.period || "week", days, kinds, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 });
  }
}
