import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Upload, toUpload } from "@/lib/models";
import { resolveScope } from "@/lib/api/scope";

// GET /api/uploads?transportId= — upload history (for the Uploads / Undo screen)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(request, { roles: ["owner", "manager"], transportId: searchParams.get("transportId") });
  if (scope.error) return scope.error;
  await dbConnect();
  const uploads = await Upload.find({ transportId: scope.transportId }).sort({ createdAt: -1 }).limit(200);
  return NextResponse.json({ uploads: uploads.map(toUpload) });
}
