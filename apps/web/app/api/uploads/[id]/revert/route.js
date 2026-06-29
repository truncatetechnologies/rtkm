import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Upload } from "@/lib/models";
import { requireAuth, canAccessTransport } from "@/lib/auth/session";
import { unauth } from "@/lib/api/scope";
import { revertUpload } from "@/lib/services/ledger";

// POST /api/uploads/:id/revert — undo what this upload did (owner/manager).
export async function POST(request, { params }) {
  const me = await requireAuth(request, { roles: ["owner", "manager"] });
  if (!me) return unauth();
  await dbConnect();
  const upload = await Upload.findById(params.id);
  if (!upload || !(await canAccessTransport(me, upload.transportId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const scope = { transportId: String(upload.transportId), ownerId: me.ownerId };
  const result = await revertUpload({ scope, upload });
  if (result.error) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, ...result });
}
