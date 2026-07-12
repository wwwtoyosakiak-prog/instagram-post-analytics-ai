import { NextResponse } from "next/server";
import type { GrowthStrategyResult } from "@/lib/growth-strategy";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = {
  id: string;
  score: number;
  post_count: number;
  posts_per_week: number;
  average_views: number;
  average_engagement_rate: number;
  average_save_rate: number;
  average_share_rate: number;
  period_from: string | null;
  period_to: string | null;
  created_at: string;
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
    throw new Error((await response.text()) || "Supabase request failed.");
  }

  return response.json() as Promise<T>;
}

function mapRow(row: Row) {
  return {
    id: row.id,
    score: Number(row.score),
    postCount: Number(row.post_count),
    postsPerWeek: Number(row.posts_per_week),
    averageViews: Number(row.average_views),
    averageEngagementRate: Number(row.average_engagement_rate),
    averageSaveRate: Number(row.average_save_rate),
    averageShareRate: Number(row.average_share_rate),
    periodFrom: row.period_from,
    periodTo: row.period_to,
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const rows = await request<Row[]>(
      "growth_strategy_snapshots?select=*&order=created_at.desc&limit=100",
    );
    return NextResponse.json({ snapshots: rows.map(mapRow) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "成長履歴を取得できませんでした。" },
      { status: 500 },
    );
  }
}

export async function POST(requestObject: Request) {
  let body: { strategy?: GrowthStrategyResult };

  try {
    body = (await requestObject.json()) as {
      strategy?: GrowthStrategyResult;
    };
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.strategy) {
    return NextResponse.json(
      { error: "成長戦略データが必要です。" },
      { status: 400 },
    );
  }

  const strategy = body.strategy;

  try {
    const rows = await request<Row[]>(
      "growth_strategy_snapshots",
      {
        method: "POST",
        body: JSON.stringify({
          score: strategy.score,
          post_count: strategy.summary.postCount,
          posts_per_week: strategy.summary.postsPerWeek,
          average_views: strategy.summary.averageViews,
          average_engagement_rate: strategy.summary.averageEngagementRate,
          average_save_rate: strategy.summary.averageSaveRate,
          average_share_rate: strategy.summary.averageShareRate,
          period_from: strategy.period.from,
          period_to: strategy.period.to,
          strategy,
        }),
      },
    );

    return NextResponse.json({ snapshot: mapRow(rows[0]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "成長戦略を保存できませんでした。" },
      { status: 500 },
    );
  }
}
