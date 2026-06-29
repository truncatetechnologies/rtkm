import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { extractText } from "@/lib/pdf/extract";
import { parseFreightStatement } from "@/lib/pdf/ledger";
import { importFreightStatement } from "@/lib/services/ledger";
import { storeAndParse } from "@/lib/pdf/ingest";

// POST /api/uploads/shortage (multipart: file, transportId)
// Smart: if the PDF is a multi-row Delivery/Freight Statement, import the whole table
// (map each row to its invoice, record shortages + freight). Otherwise treat as a single
// shortage report and return a draft to review.
export async function POST(request) {
  const form = await request.formData();
  const file = form.get("file");
  const transportId = form.get("transportId");
  const scope = await resolveScope(request, { roles: ["owner", "manager", "driver"], transportId });
  if (scope.error) return scope.error;
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractText(buffer);

  // Statement of Freight (multi-row table) — detect by structure, not title.
  const freight = parseFreightStatement(text);
  if (freight.rows.length) {
    const r = await importFreightStatement({ scope, parsed: freight });
    return NextResponse.json({
      delivery: true, kind: "freight", reference: freight.reference,
      rows: freight.rows.length, ...r,
    });
  }

  // Single shortage report
  const out = await storeAndParse({ scope, kind: "shortage", buffer, filename: file.name, source: "upload" });
  return NextResponse.json({
    delivery: false,
    uploadId: String(out.upload._id),
    company: out.parsed.company,
    confidence: out.parsed.confidence,
    draft: out.parsed.fields,
    textPreview: out.textPreview,
    duplicate: out.duplicate,
    firstSeenAt: out.firstSeenAt,
  });
}
