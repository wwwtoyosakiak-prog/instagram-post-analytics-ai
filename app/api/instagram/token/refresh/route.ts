import { NextResponse } from "next/server";
import { refreshInstagramAccessToken } from "@/lib/instagram-token-manager";
import { getAuthenticatedUser } from "@/lib/authenticated-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (getAuthenticatedUser(request) !== "owner") {
      return NextResponse.json({ ok: true, skipped: true, refreshed: false, message: "ユーザー専用連携はVercelの設定から更新します。" });
    }
    const result = await refreshInstagramAccessToken("manual");
    return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, refreshed: false, message: error instanceof Error ? error.message : "トークン更新に失敗しました。" },
      { status: 500 }
    );
  }
}
