import { NextResponse } from "next/server";
import { ingestPdf } from "@/lib/pdf/ingest";

// POST /api/uploads/invoice (multipart: file, transportId) — parse an invoice PDF into a draft
export async function POST(request) {
  const r = await ingestPdf(request, "invoice");
  if (r.error) return r.error;
  if (r.errorMsg) return NextResponse.json({ error: r.errorMsg }, { status: 400 });
  return NextResponse.json({
    uploadId: String(r.upload._id),
    company: r.parsed.company,
    confidence: r.parsed.confidence,
    draft: r.parsed.fields,
    textPreview: r.textPreview,
    duplicate: r.duplicate,
    firstSeenAt: r.firstSeenAt,
  });
}
