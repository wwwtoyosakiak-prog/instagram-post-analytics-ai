import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SnapshotRow = {
  id: string;
  snapshot_date: string;
  total_score: number;
  schedule_score: number;
  preparation_score: number;
  consistency_score: number;
  growth_score: number;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  created_at: string;
  updated_at: string;
};

type PostBody = {
  snapshotDate?: string;
  totalScore?: number;
  scheduleScore?: number;
  preparationScore?: number;
  consistencyScore?: number;
  growthScore?: number;
  totalTasks?: number;
  completedTasks?: number;
  completionRate?: number;
  summary?: unknown;
  warnings?: unknown;
};

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer:
        "resolution=merge-duplicates,return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      (await response.text()) || "Supabase request failed.",
    );
  }

  return response.json() as Promise<T>;
}

function mapRow(row: SnapshotRow) {
  return {
    id: row.id,
    snapshotDate: row.snapshot_date,
    totalScore: Number(row.total_score),
    scheduleScore: Number(row.schedule_score),
    preparationScore: Number(row.preparation_score),
    consistencyScore: Number(row.consistency_score),
    growthScore: Number(row.growth_score),
    totalTasks: Number(row.total_tasks),
    completedTasks: Number(row.completed_tasks),
    completionRate: Number(row.completion_rate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const rows = await request<SnapshotRow[]>(
      "ai_manager_daily_snapshots?select=*&order=snapshot_date.desc&limit=100",
    );

    return NextResponse.json({
      snapshots: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "日次記録を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function POST(requestObject: Request) {
  let body: PostBody;

  try {
    body = (await requestObject.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.snapshotDate) {
    return NextResponse.json(
      { error: "記録日が必要です。" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  try {
    const rows = await request<SnapshotRow[]>(
      "ai_manager_daily_snapshots?on_conflict=snapshot_date",
      {
        method: "POST",
        body: JSON.stringify({
          snapshot_date: body.snapshotDate,
          total_score: body.totalScore ?? 0,
          schedule_score: body.scheduleScore ?? 0,
          preparation_score: body.preparationScore ?? 0,
          consistency_score: body.consistencyScore ?? 0,
          growth_score: body.growthScore ?? 0,
          total_tasks: body.totalTasks ?? 0,
          completed_tasks: body.completedTasks ?? 0,
          completion_rate: body.completionRate ?? 0,
          summary: body.summary ?? {},
          warnings: body.warnings ?? [],
          updated_at: now,
        }),
      },
    );

    return NextResponse.json({
      snapshot: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "日次記録を保存できませんでした。",
      },
      { status: 500 },
    );
  }
}
