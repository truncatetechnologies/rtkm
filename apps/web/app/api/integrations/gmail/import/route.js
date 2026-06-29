import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { GmailConnection } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";
import { accessTokenFromRefresh, getAttachment } from "@/lib/google/gmail";
import { decryptSecret } from "@/lib/crypto";
import { storeAndParse } from "@/lib/pdf/ingest";
import { processLedgerPdf } from "@/lib/services/ledger";

// POST /api/integrations/gmail/import { transportId, messageId, attachmentId, filename, kind }
// kind "auto"            -> auto-detect (invoice / freight statement / bank advice) and FILE it (bulk import).
// kind invoice/shortage  -> download + parse to a draft the UI then confirms (per-document flow).
export async function POST(request) {
  const b = await request.json();
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: b.transportId });
  if (scope.error) return scope.error;
  if (!b.messageId || !b.attachmentId) return NextResponse.json({ error: "messageId & attachmentId required" }, { status: 400 });

  await dbConnect();
  const conn = await GmailConnection.findOne({ transportId: scope.transportId });
  if (!conn?.refreshTokenEnc) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  try {
    const token = await accessTokenFromRefresh(decryptSecret(conn.refreshTokenEnc));
    const buffer = await getAttachment(token, b.messageId, b.attachmentId);
    const filename = b.filename || "email.pdf";

    if (b.kind === "auto") {
      const result = await processLedgerPdf({ scope, buffer, filename }); // auto-detect + file
      return NextResponse.json(result); // { kind, duplicate, created, ... } (kind null => unrecognised)
    }

    const kind = b.kind === "shortage" ? "shortage" : "invoice";
    const r = await storeAndParse({ scope, kind, buffer, filename, source: "gmail" });
    return NextResponse.json({
      uploadId: String(r.upload._id),
      company: r.parsed.company,
      confidence: r.parsed.confidence,
      draft: r.parsed.fields,
      textPreview: r.textPreview,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 });
  }
}
