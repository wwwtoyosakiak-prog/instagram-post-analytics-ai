import { NextResponse } from "next/server";
import { refreshInstagramAccessToken } from "@/lib/instagram-token-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await refreshInstagramAccessToken("manual");
    return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, refreshed: false, message: error instanceof Error ? error.message : "トークン更新に失敗しました。" },
      { status: 500 }
    );
  }
}
