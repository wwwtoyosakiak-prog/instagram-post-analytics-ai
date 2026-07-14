import { NextRequest, NextResponse } from "next/server";
import {
  buildLearningSummary,
  buildTags,
  calculateImprovementRate,
  calculateLearningStats,
  findSimilarMemories,
  outcomeFromStatus,
  type AiLearningMemory,
  type LearningOutcome,
} from "@/lib/ai-learning";
import type {
  ImprovementCycleStatus,
} from "@/lib/ai-improvement-cycle";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type MemoryRow = {
  id: string;
  improvement_cycle_id: string | null;
  title: string;
  hypothesis: string;
  action: string;
  metric_name: string;
  baseline_value: number | null;
  target_value: number | null;
  result_value: number | null;
  improvement_rate: number | null;
  outcome: LearningOutcome;
  learning_summary: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type PostBody = {
  improvementCycleId?: string;
  title?: string;
  hypothesis?: string;
  action?: string;
  metricName?: string;
  baselineValue?: number | null;
  targetValue?: number | null;
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

function mapRow(row: MemoryRow): AiLearningMemory {
  return {
    id: row.id,
    improvementCycleId: row.improvement_cycle_id,
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
    improvementRate:
      row.improvement_rate === null
        ? null
        : Number(row.improvement_rate),
    outcome: row.outcome,
    learningSummary: row.learning_summary,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(requestObject: NextRequest) {
  const query =
    requestObject.nextUrl.searchParams.get("query") ??
    "";

  try {
    const rows = await request<MemoryRow[]>(
      "ai_learning_memory?select=*&order=created_at.desc&limit=200",
    );
    const memories = rows.map(mapRow);
    const similar = query.trim()
      ? findSimilarMemories(query, memories)
      : [];

    return NextResponse.json({
      memories,
      stats: calculateLearningStats(memories),
      similar,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI学習データを取得できませんでした。",
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
    !body.title?.trim() ||
    !body.hypothesis?.trim() ||
    !body.action?.trim() ||
    !body.metricName?.trim() ||
    !body.status
  ) {
    return NextResponse.json(
      { error: "学習に必要な項目が不足しています。" },
      { status: 400 },
    );
  }

  const outcome = outcomeFromStatus(body.status);
  const improvementRate = calculateImprovementRate(
    body.baselineValue ?? null,
    body.targetValue ?? null,
    body.resultValue ?? null,
  );
  const learningSummary = buildLearningSummary({
    title: body.title.trim(),
    metricName: body.metricName.trim(),
    baselineValue: body.baselineValue ?? null,
    targetValue: body.targetValue ?? null,
    resultValue: body.resultValue ?? null,
    status: body.status,
    evaluation: body.evaluation?.trim() ?? "",
  });
  const now = new Date().toISOString();

  try {
    const rows = await request<MemoryRow[]>(
      "ai_learning_memory?on_conflict=improvement_cycle_id",
      {
        method: "POST",
        body: JSON.stringify({
          improvement_cycle_id:
            body.improvementCycleId ?? null,
          title: body.title.trim(),
          hypothesis: body.hypothesis.trim(),
          action: body.action.trim(),
          metric_name: body.metricName.trim(),
          baseline_value:
            body.baselineValue ?? null,
          target_value: body.targetValue ?? null,
          result_value: body.resultValue ?? null,
          improvement_rate: improvementRate,
          outcome,
          learning_summary: learningSummary,
          tags: buildTags(
            body.title,
            body.metricName,
            body.action,
          ),
          updated_at: now,
        }),
      },
    );

    return NextResponse.json({
      memory: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI学習データを保存できませんでした。",
      },
      { status: 500 },
    );
  }
}
