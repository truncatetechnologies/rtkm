import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection, toGmail } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { cleanSender } from "@/lib/services/gmailImport";

// POST /api/integrations/gmail/senders { transportId, senders: [] | "a, b" }
// Save the trusted sender domains/addresses for this inbox. The cron only alerts (and bulk-import
// only pulls) PDFs whose from/to/cc matches one of these — so unrelated inbox PDFs never notify.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn) return NextResponse.json({ error: "Gmail not connected" }, { status: 404 });

  const raw = Array.isArray(b.senders) ? b.senders : String(b.senders || "").split(/[\n,]+/);
  conn.senders = [...new Set(raw.map(cleanSender).filter(Boolean))];
  await conn.save();
  return NextResponse.json({ gmail: toGmail(conn) });
}
