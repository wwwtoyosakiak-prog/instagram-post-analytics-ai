import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { deleteStoredInstagramConnection } from "@/lib/instagram-connection-store";

export async function POST(request: NextRequest) {
  await deleteStoredInstagramConnection(getAuthenticatedUser(request));
  return NextResponse.json({ ok: true });
}
