import { NextResponse } from "next/server";
import { getStoredInstagramConnectionByInstagramUserId, deleteStoredInstagramConnection } from "@/lib/instagram-connection-store";
import { readAndVerifyMetaSignedRequest } from "@/lib/meta-signed-request";

export async function POST(request: Request) {
  const payload = await readAndVerifyMetaSignedRequest(request);
  if (!payload?.user_id) return NextResponse.json({ error: "Invalid signed request." }, { status: 400 });

  const connection = await getStoredInstagramConnectionByInstagramUserId(payload.user_id);
  if (connection) await deleteStoredInstagramConnection(connection.owner_id);
  return NextResponse.json({ success: true });
}
