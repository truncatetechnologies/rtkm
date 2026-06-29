import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { processLedgerPdf } from "@/lib/services/ledger";

// POST /api/ledger/upload (multipart: file, transportId)
// Auto-detects freight statement (→ loads) or payment advice (→ reconcile).
export async function POST(request) {
  const form = await request.formData();
  const file = form.get("file");
  const transportId = form.get("transportId");
  const force = String(form.get("force") || "") === "true"; // process even when source invoices are missing
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId });
  if (scope.error) return scope.error;
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processLedgerPdf({ scope, buffer, filename: file.name, force });
    // Return 200 even when unrecognised so the client can show the extracted text for tuning.
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
