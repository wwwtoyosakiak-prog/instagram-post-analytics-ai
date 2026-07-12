import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RunRow = {
  id: string;
  trigger_type: "cron" | "manual";
  status: "running" | "success" | "failed";
  candidate_count: number;
  inserted_count: number;
  error_message: string | null;
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
    `${supabaseUrl}/rest/v1/notification_generation_runs?select=*&order=started_at.desc&limit=30`,
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
      { error: await response.text() },
      { status: response.status },
    );
  }

  const rows = (await response.json()) as RunRow[];

  return NextResponse.json({
    runs: rows.map((row) => ({
      id: row.id,
      triggerType: row.trigger_type,
      status: row.status,
      candidateCount: row.candidate_count,
      insertedCount: row.inserted_count,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  });
}
