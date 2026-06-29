import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/api/scope";
import { importFastagPdf } from "@/lib/services/fastag";

// POST /api/fastag/upload (multipart: file, transportId) — BlackBuck BOSS wallet or per-tanker PDF.
export async function POST(request) {
  const form = await request.formData();
  const file = form.get("file");
  const transportId = form.get("transportId");
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId });
  if (scope.error) return scope.error;
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return NextResponse.json(await importFastagPdf({ scope, buffer, filename: file.name }));
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
