import { NextResponse } from "next/server";
import { DEPOTS } from "@rtkm/shared";

export async function GET() {
  return NextResponse.json({ depots: DEPOTS });
}
