import { NextRequest, NextResponse } from "next/server";
import { buildPerformanceReport } from "@/lib/performance-report";
import { isSupabaseConfigured, listPostsFromSupabase, listScoreHistoryFromSupabase } from "@/lib/supabase-admin";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const accountId = request.nextUrl.searchParams.get("accountId") || undefined;

  if (!validDate(from) || !validDate(to)) {
    return NextResponse.json(
      { error: "fromとtoをYYYY-MM-DD形式で指定してください。" },
      { status: 400 },
    );
  }

  if (from > to) {
    return NextResponse.json({ error: "fromはto以前の日付にしてください。" }, { status: 400 });
  }

  const [posts, scoreHistory] = await Promise.all([
    listPostsFromSupabase(),
    listScoreHistoryFromSupabase(undefined, 5000),
  ]);

  const report = buildPerformanceReport({
    posts,
    scoreHistory,
    period: { from, to },
    accountId,
  });

  return NextResponse.json({ report });
}
