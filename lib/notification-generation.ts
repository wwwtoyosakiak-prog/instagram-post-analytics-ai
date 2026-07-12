import {
  buildScheduleNotifications,
  type ScheduleSource,
} from "@/lib/notification-center";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TriggerType = "cron" | "manual";

type ScheduleRow = {
  id: string;
  title: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  schedule_status: string;
  reminder_enabled: boolean;
  result: {
    caption?: string;
    hashtags?: string[];
    thumbnailText?: string;
  } | null;
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

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer:
        "resolution=ignore-duplicates,return=representation",
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

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function startRun(triggerType: TriggerType) {
  const rows = await supabaseRequest<RunRow[]>(
    "notification_generation_runs",
    {
      method: "POST",
      body: JSON.stringify({
        trigger_type: triggerType,
        status: "running",
      }),
    },
  );

  return rows[0]?.id ?? null;
}

async function finishRun(
  runId: string | null,
  data: {
    status: "success" | "failed";
    candidateCount?: number;
    insertedCount?: number;
    errorMessage?: string;
  },
) {
  if (!runId) return;

  await supabaseRequest<RunRow[]>(
    `notification_generation_runs?id=eq.${encodeURIComponent(
      runId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: data.status,
        candidate_count: data.candidateCount ?? 0,
        inserted_count: data.insertedCount ?? 0,
        error_message: data.errorMessage ?? null,
        finished_at: new Date().toISOString(),
      }),
    },
  );
}

export async function generateOperationNotifications(
  triggerType: TriggerType,
) {
  const runId = await startRun(triggerType);

  try {
    const rows = await supabaseRequest<ScheduleRow[]>(
      "ai_post_plans?select=id,title,scheduled_date,scheduled_time,schedule_status,reminder_enabled,result",
    );

    const schedules: ScheduleSource[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      scheduleStatus: row.schedule_status,
      reminderEnabled: row.reminder_enabled,
      caption: row.result?.caption ?? "",
      hashtags: Array.isArray(row.result?.hashtags)
        ? row.result.hashtags
        : [],
      thumbnailText: row.result?.thumbnailText ?? "",
    }));

    const candidates = buildScheduleNotifications(
      schedules,
      todayInTokyo(),
    );

    let insertedCount = 0;

    if (candidates.length) {
      const inserted = await supabaseRequest<
        Array<{ id: string }>
      >("operation_notifications?on_conflict=dedupe_key", {
        method: "POST",
        body: JSON.stringify(
          candidates.map((item) => ({
            source_type: item.sourceType,
            source_id: item.sourceId,
            notification_type: item.notificationType,
            severity: item.severity,
            title: item.title,
            message: item.message,
            action_url: item.actionUrl,
            dedupe_key: item.dedupeKey,
          })),
        ),
      });

      insertedCount = inserted.length;
    }

    await finishRun(runId, {
      status: "success",
      candidateCount: candidates.length,
      insertedCount,
    });

    return {
      success: true,
      candidates: candidates.length,
      inserted: insertedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "通知生成に失敗しました。";

    await finishRun(runId, {
      status: "failed",
      errorMessage: message,
    });

    throw error;
  }
}
