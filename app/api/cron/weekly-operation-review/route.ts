import { NextRequest, NextResponse } from "next/server";
import {
  buildWeeklyOperationReview,
} from "@/lib/weekly-operation-review";
import {
  buildAiWeeklyReviewPrompt,
  normalizeAiWeeklyReview,
} from "@/lib/ai-weekly-review";
import {
  previousWeekReferenceDate,
  type AutomationTrigger,
} from "@/lib/weekly-review-automation";
import {
  defaultWeeklyReviewAutomationSettings,
  normalizeWeeklyReviewAutomationSettings,
  type WeeklyReviewAutomationSettings,
} from "@/lib/weekly-review-automation-settings";
import {
  decideWeeklyReviewAutomation,
} from "@/lib/weekly-review-automation-runner";
import type {
  ManagerDailySnapshot,
} from "@/lib/ai-manager-history";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const openAiKey = process.env.OPENAI_API_KEY;

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

type SettingsRow = {
  enabled: boolean;
  manual_only: boolean;
  minimum_recorded_days: number;
  skip_ai_when_insufficient: boolean;
  ai_model: string;
  updated_at: string;
};

type RunRow = {
  id: string;
};

async function supabaseRequest<T>(
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

function mapSettings(
  row: SettingsRow,
): WeeklyReviewAutomationSettings {
  return normalizeWeeklyReviewAutomationSettings({
    enabled: row.enabled,
    manualOnly: row.manual_only,
    minimumRecordedDays:
      row.minimum_recorded_days,
    skipAiWhenInsufficient:
      row.skip_ai_when_insufficient,
    aiModel: row.ai_model,
    updatedAt: row.updated_at,
  });
}

async function loadSettings() {
  const rows = await supabaseRequest<SettingsRow[]>(
    "ai_weekly_review_settings?select=*&id=eq.1&limit=1",
  );

  return rows[0]
    ? mapSettings(rows[0])
    : defaultWeeklyReviewAutomationSettings();
}

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function triggerType(
  request: NextRequest,
): AutomationTrigger {
  return request.nextUrl.searchParams.get("manual") === "1"
    ? "manual"
    : "cron";
}

function authorized(request: NextRequest) {
  if (!cronSecret) return false;

  const bearer =
    request.headers.get("authorization") ?? "";

  return bearer === `Bearer ${cronSecret}`;
}

async function createRun(
  trigger: AutomationTrigger,
  model: string,
) {
  const rows = await supabaseRequest<RunRow[]>(
    "ai_weekly_review_runs",
    {
      method: "POST",
      body: JSON.stringify({
        trigger_type: trigger,
        status: "running",
        ai_model: model,
        message: "週次レビューを作成しています。",
      }),
    },
  );

  return rows[0]?.id;
}

async function finishRun(
  id: string | undefined,
  values: Record<string, unknown>,
) {
  if (!id) return;

  await supabaseRequest<RunRow[]>(
    `ai_weekly_review_runs?id=eq.${encodeURIComponent(
      id,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...values,
        finished_at: new Date().toISOString(),
      }),
    },
  );
}

async function generateAiReview(
  review: ReturnType<
    typeof buildWeeklyOperationReview
  >,
  model: string,
) {
  if (!openAiKey) {
    throw new Error(
      "OPENAI_API_KEYを設定してください。",
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildAiWeeklyReviewPrompt(review),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        "OpenAI APIの呼び出しに失敗しました。",
    );
  }

  const raw =
    data.output_text ??
    data.output
      ?.flatMap(
        (item: {
          content?: Array<{ text?: string }>;
        }) => item.content ?? [],
      )
      .map(
        (item: { text?: string }) =>
          item.text ?? "",
      )
      .join("");

  const normalized = normalizeAiWeeklyReview(
    JSON.parse(raw || "{}"),
  );

  if (
    !normalized.executiveSummary ||
    !normalized.nextWeekPriority.title
  ) {
    throw new Error(
      "AI回答に必要な項目が不足しています。",
    );
  }

  return normalized;
}

export async function GET(request: NextRequest) {
  const trigger = triggerType(request);

  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let runId: string | undefined;
  let settings =
    defaultWeeklyReviewAutomationSettings();

  try {
    settings = await loadSettings();
    runId = await createRun(
      trigger,
      settings.aiModel,
    );

    const snapshots = await supabaseRequest<
      SnapshotRow[]
    >(
      "ai_manager_daily_snapshots?select=*&order=snapshot_date.desc&limit=21",
    );

    const referenceDate = previousWeekReferenceDate(
      todayInTokyo(),
    );
    const review = buildWeeklyOperationReview(
      snapshots.map(mapSnapshot),
      referenceDate,
    );

    const decision =
      decideWeeklyReviewAutomation(
        settings,
        trigger,
        review.daysRecorded,
      );

    if (!decision.shouldRun) {
      await finishRun(runId, {
        status: "skipped",
        target_week_start: review.weekStart,
        target_week_end: review.weekEnd,
        ai_model: settings.aiModel,
        message: decision.reason,
        details: {
          settings,
          daysRecorded: review.daysRecorded,
        },
      });

      return NextResponse.json({
        status: "skipped",
        reason: decision.reason,
        settings,
        review,
      });
    }

    await supabaseRequest(
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

    if (!decision.shouldGenerateAi) {
      await finishRun(runId, {
        status: "success",
        target_week_start: review.weekStart,
        target_week_end: review.weekEnd,
        ai_model: settings.aiModel,
        message: decision.reason,
        details: {
          settings,
          daysRecorded: review.daysRecorded,
          aiGenerated: false,
        },
      });

      return NextResponse.json({
        status: "success",
        aiGenerated: false,
        reason: decision.reason,
        settings,
        review,
      });
    }

    const aiReview = await generateAiReview(
      review,
      settings.aiModel,
    );
    const generatedAt = new Date().toISOString();

    await supabaseRequest(
      `ai_manager_weekly_reviews?week_start=eq.${encodeURIComponent(
        review.weekStart,
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ai_review: aiReview,
          ai_model: settings.aiModel,
          ai_generated_at: generatedAt,
          updated_at: generatedAt,
        }),
      },
    );

    await finishRun(runId, {
      status: "success",
      target_week_start: review.weekStart,
      target_week_end: review.weekEnd,
      ai_model: settings.aiModel,
      message:
        "数値版とAI版の週次レビューを保存しました。",
      details: {
        daysRecorded: review.daysRecorded,
        totalScore: review.averages.totalScore,
        completionRate:
          review.averages.completionRate,
      },
    });

    return NextResponse.json({
      status: "success",
      review,
      aiReview,
      model: settings.aiModel,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "自動週次レビューに失敗しました。";

    await finishRun(runId, {
      status: "failed",
      ai_model: settings.aiModel,
      message,
      details: {},
    });

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
