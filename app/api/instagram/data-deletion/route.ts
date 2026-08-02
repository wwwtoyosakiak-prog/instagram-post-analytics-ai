import { NextResponse } from "next/server";
import { processInstagramDataDeletion } from "@/lib/instagram-data-deletion";
import { readAndVerifyMetaSignedRequest } from "@/lib/meta-signed-request";

export async function POST(request: Request) {
  const payload = await readAndVerifyMetaSignedRequest(request);
  if (!payload?.user_id) return NextResponse.json({ error: "Invalid signed request." }, { status: 400 });

  try {
    const confirmationCode = await processInstagramDataDeletion(payload.user_id);
    const statusUrl = new URL("/data-deletion/status", request.url);
    statusUrl.searchParams.set("code", confirmationCode);
    return NextResponse.json({ url: statusUrl.toString(), confirmation_code: confirmationCode });
  } catch {
    return NextResponse.json({ error: "Unable to process deletion request." }, { status: 500 });
  }
}
