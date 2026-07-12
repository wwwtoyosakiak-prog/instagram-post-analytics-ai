import { NextResponse } from "next/server";
import {
  normalizeMetrics,
  type KpiMetrics,
} from "@/lib/post-kpi";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type KpiRow = {
  id: string;
  title: string;
  theme: string;
  post_type: string;
  scheduled_date: string | null;
  linked_post_id: string | null;
  predicted_views: number | null;
  predicted_likes: number | null;
  predicted_comments: number | null;
  predicted_saves: number | null;
  predicted_shares: number | null;
  actual_views: number | null;
  actual_likes: number | null;
  actual_comments: number | null;
  actual_saves: number | null;
  actual_shares: number | null;
  evaluated_at: string | null;
};

type PatchBody = {
  id?: string;
  linkedPostId?: string | null;
  predicted?: Partial<KpiMetrics>;
  actual?: Partial<KpiMetrics>;
  markEvaluated?: boolean;
};

async function supabaseRequest<T>(
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

function mapRow(row: KpiRow) {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    postType: row.post_type,
    scheduledDate: row.scheduled_date,
    linkedPostId: row.linked_post_id,
    predicted: normalizeMetrics({
      views: row.predicted_views ?? 0,
      likes: row.predicted_likes ?? 0,
      comments: row.predicted_comments ?? 0,
      saves: row.predicted_saves ?? 0,
      shares: row.predicted_shares ?? 0,
    }),
    actual: normalizeMetrics({
      views: row.actual_views ?? 0,
      likes: row.actual_likes ?? 0,
      comments: row.actual_comments ?? 0,
      saves: row.actual_saves ?? 0,
      shares: row.actual_shares ?? 0,
    }),
    evaluatedAt: row.evaluated_at,
  };
}

export async function GET() {
  try {
    const rows = await supabaseRequest<KpiRow[]>(
      "ai_post_plans?select=id,title,theme,post_type,scheduled_date,linked_post_id,predicted_views,predicted_likes,predicted_comments,predicted_saves,predicted_shares,actual_views,actual_likes,actual_comments,actual_saves,actual_shares,evaluated_at&order=scheduled_date.desc.nullslast",
    );

    return NextResponse.json({
      plans: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "KPI情報を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.id) {
    return NextResponse.json(
      { error: "更新対象のIDが必要です。" },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {};

  if (body.linkedPostId !== undefined) {
    payload.linked_post_id = body.linkedPostId || null;
  }

  if (body.predicted) {
    const value = normalizeMetrics(body.predicted);
    payload.predicted_views = value.views;
    payload.predicted_likes = value.likes;
    payload.predicted_comments = value.comments;
    payload.predicted_saves = value.saves;
    payload.predicted_shares = value.shares;
  }

  if (body.actual) {
    const value = normalizeMetrics(body.actual);
    payload.actual_views = value.views;
    payload.actual_likes = value.likes;
    payload.actual_comments = value.comments;
    payload.actual_saves = value.saves;
    payload.actual_shares = value.shares;
  }

  if (body.markEvaluated) {
    payload.evaluated_at = new Date().toISOString();
  }

  try {
    const rows = await supabaseRequest<KpiRow[]>(
      `ai_post_plans?id=eq.${encodeURIComponent(body.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    if (!rows[0]) {
      throw new Error("更新結果がありません。");
    }

    return NextResponse.json({
      plan: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "KPI情報を更新できませんでした。",
      },
      { status: 500 },
    );
  }
}
