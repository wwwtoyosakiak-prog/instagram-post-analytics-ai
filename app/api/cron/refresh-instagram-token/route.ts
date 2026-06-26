import { NextResponse } from "next/server";
import { isCronAuthorized, maybeRefreshInstagramAccessTokenForCron } from "@/lib/instagram-token-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = isCronAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const result = await maybeRefreshInstagramAccessTokenForCron();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, refreshed: false, skipped: false, message: error instanceof Error ? error.message : "Cron実行に失敗しました。" },
      { status: 500 }
    );
  }
}
