import { NextRequest, NextResponse } from "next/server";
import {
  buildWeeklyOperationReview,
  type WeeklyOperationReview,
} from "@/lib/weekly-operation-review";
import type { ManagerDailySnapshot } from "@/lib/ai-manager-history";

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

type ReviewRow = {
  id: string;
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

function mapSnapshot(
  row: SnapshotRow,
): ManagerDailySnapshot {
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

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(requestObject: NextRequest) {
  const date =
    requestObject.nextUrl.searchParams.get("date") ??
    todayInTokyo();

  try {
    const rows = await request<SnapshotRow[]>(
      "ai_manager_daily_snapshots?select=*&order=snapshot_date.desc&limit=30",
    );

    return NextResponse.json({
      review: buildWeeklyOperationReview(
        rows.map(mapSnapshot),
        date,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "週間レビューを作成できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function POST(requestObject: Request) {
  let body: { review?: WeeklyOperationReview };

  try {
    body = (await requestObject.json()) as {
      review?: WeeklyOperationReview;
    };
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.review) {
    return NextResponse.json(
      { error: "週間レビューが必要です。" },
      { status: 400 },
    );
  }

  const review = body.review;

  try {
    const rows = await request<ReviewRow[]>(
      "ai_manager_weekly_reviews?on_conflict=week_start",
      {
        method: "POST",
        body: JSON.stringify({
          week_start: review.weekStart,
          week_end: review.weekEnd,
          average_total_score:
            review.averages.totalScore,
          average_schedule_score:
            review.averages.scheduleScore,
          average_preparation_score:
            review.averages.preparationScore,
          average_consistency_score:
            review.averages.consistencyScore,
          average_growth_score:
            review.averages.growthScore,
          average_completion_rate:
            review.averages.completionRate,
          completed_tasks: review.tasks.completed,
          total_tasks: review.tasks.total,
          review,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    return NextResponse.json({
      saved: Boolean(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "週間レビューを保存できませんでした。",
      },
      { status: 500 },
    );
  }
}
