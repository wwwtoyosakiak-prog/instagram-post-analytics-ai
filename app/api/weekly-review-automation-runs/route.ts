import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = {
  id: string;
  trigger_type: "cron" | "manual";
  status:
    | "running"
    | "success"
    | "failed"
    | "skipped";
  target_week_start: string | null;
  target_week_end: string | null;
  ai_model: string | null;
  message: string | null;
  started_at: string;
  finished_at: string | null;
};

export async function GET() {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 },
    );
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/ai_weekly_review_runs?select=*&order=started_at.desc&limit=30`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          (await response.text()) ||
          "実行履歴を取得できませんでした。",
      },
      { status: 500 },
    );
  }

  const rows = (await response.json()) as Row[];

  return NextResponse.json({
    runs: rows.map((row) => ({
      id: row.id,
      triggerType: row.trigger_type,
      status: row.status,
      targetWeekStart: row.target_week_start,
      targetWeekEnd: row.target_week_end,
      aiModel: row.ai_model ?? "",
      message: row.message ?? "",
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  });
}
