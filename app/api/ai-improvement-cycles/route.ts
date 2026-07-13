import { NextRequest, NextResponse } from "next/server";
import type {
  ImprovementCycleStatus,
} from "@/lib/ai-improvement-cycle";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = {
  id: string;
  week_start: string;
  week_end: string;
  title: string;
  hypothesis: string;
  action: string;
  metric_name: string;
  baseline_value: number | null;
  target_value: number | null;
  result_value: number | null;
  status: ImprovementCycleStatus;
  evaluation: string | null;
  created_at: string;
  updated_at: string;
};

type PostBody = {
  weekStart?: string;
  weekEnd?: string;
  title?: string;
  hypothesis?: string;
  action?: string;
  metricName?: string;
  baselineValue?: number | null;
  targetValue?: number | null;
};

type PatchBody = {
  id?: string;
  resultValue?: number | null;
  status?: ImprovementCycleStatus;
  evaluation?: string;
};

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${path}`,
    {
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
    },
  );

  if (!response.ok) {
    throw new Error(
      (await response.text()) ||
        "Supabase request failed.",
    );
  }

  return response.json() as Promise<T>;
}

function mapRow(row: Row) {
  return {
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    title: row.title,
    hypothesis: row.hypothesis,
    action: row.action,
    metricName: row.metric_name,
    baselineValue:
      row.baseline_value === null
        ? null
        : Number(row.baseline_value),
    targetValue:
      row.target_value === null
        ? null
        : Number(row.target_value),
    resultValue:
      row.result_value === null
        ? null
        : Number(row.result_value),
    status: row.status,
    evaluation: row.evaluation ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const rows = await request<Row[]>(
      "ai_improvement_cycles?select=*&order=week_start.desc,created_at.desc&limit=100",
    );

    return NextResponse.json({
      cycles: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "改善サイクルを取得できませんでした。",
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

  if (
    !body.weekStart ||
    !body.weekEnd ||
    !body.title?.trim() ||
    !body.hypothesis?.trim() ||
    !body.action?.trim() ||
    !body.metricName?.trim()
  ) {
    return NextResponse.json(
      { error: "必須項目が不足しています。" },
      { status: 400 },
    );
  }

  try {
    const rows = await request<Row[]>(
      "ai_improvement_cycles",
      {
        method: "POST",
        body: JSON.stringify({
          week_start: body.weekStart,
          week_end: body.weekEnd,
          title: body.title.trim(),
          hypothesis: body.hypothesis.trim(),
          action: body.action.trim(),
          metric_name: body.metricName.trim(),
          baseline_value:
            body.baselineValue ?? null,
          target_value: body.targetValue ?? null,
          status: "planned",
        }),
      },
    );

    return NextResponse.json({
      cycle: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "改善サイクルを作成できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(requestObject: NextRequest) {
  let body: PatchBody;

  try {
    body = (await requestObject.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.id) {
    return NextResponse.json(
      { error: "更新対象IDが必要です。" },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("resultValue" in body) {
    update.result_value = body.resultValue ?? null;
  }

  if (body.status) {
    update.status = body.status;
  }

  if (typeof body.evaluation === "string") {
    update.evaluation = body.evaluation.trim();
  }

  try {
    const rows = await request<Row[]>(
      `ai_improvement_cycles?id=eq.${encodeURIComponent(
        body.id,
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify(update),
      },
    );

    if (!rows[0]) {
      return NextResponse.json(
        { error: "更新対象が見つかりません。" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      cycle: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "改善サイクルを更新できませんでした。",
      },
      { status: 500 },
    );
  }
}
