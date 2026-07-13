import { NextResponse } from "next/server";
import type { AiWeeklyReviewResult } from "@/lib/ai-weekly-review";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = {
  id: string;
  week_start: string;
  week_end: string;
  ai_review: AiWeeklyReviewResult | null;
  ai_model: string | null;
  ai_generated_at: string | null;
  updated_at: string;
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
      Prefer: "return=representation",
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

function mapRow(row: Row) {
  return {
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    aiReview: row.ai_review,
    aiModel: row.ai_model ?? "",
    aiGeneratedAt: row.ai_generated_at ?? "",
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const rows = await request<Row[]>(
      "ai_manager_weekly_reviews?select=id,week_start,week_end,ai_review,ai_model,ai_generated_at,updated_at&ai_review=not.is.null&order=week_start.desc&limit=52",
    );

    return NextResponse.json({
      items: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI週次レビュー履歴を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function POST(requestObject: Request) {
  let body: {
    weekStart?: string;
    aiReview?: AiWeeklyReviewResult;
    aiModel?: string;
  };

  try {
    body = (await requestObject.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.weekStart || !body.aiReview) {
    return NextResponse.json(
      { error: "保存対象が不足しています。" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  try {
    const rows = await request<Row[]>(
      `ai_manager_weekly_reviews?week_start=eq.${encodeURIComponent(
        body.weekStart,
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ai_review: body.aiReview,
          ai_model: body.aiModel ?? "",
          ai_generated_at: now,
          updated_at: now,
        }),
      },
    );

    if (!rows[0]) {
      return NextResponse.json(
        {
          error:
            "先に数値版の週間レビューを保存してください。",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      item: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI週次レビューを保存できませんでした。",
      },
      { status: 500 },
    );
  }
}
