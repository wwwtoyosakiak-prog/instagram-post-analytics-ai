import { NextRequest, NextResponse } from "next/server";
import { readDataDeletionStatus } from "@/lib/instagram-data-deletion";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (!code || !/^[a-f0-9]{32}$/.test(code)) return NextResponse.json({ error: "Invalid confirmation code." }, { status: 400 });
  const deletion = await readDataDeletionStatus(code);
  if (!deletion) return NextResponse.json({ error: "Deletion request not found." }, { status: 404 });
  return NextResponse.json(deletion);
}
