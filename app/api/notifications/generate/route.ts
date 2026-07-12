import { NextResponse } from "next/server";
import {
  buildScheduleNotifications,
  type ScheduleSource,
} from "@/lib/notification-center";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
      Prefer: "resolution=ignore-duplicates,return=representation",
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

export async function POST() {
  try {
    const rows = await request<ScheduleRow[]>(
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

    if (!candidates.length) {
      return NextResponse.json({
        generated: 0,
        message: "新しい通知はありません。",
      });
    }

    const inserted = await request<Array<{ id: string }>>(
      "operation_notifications?on_conflict=dedupe_key",
      {
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
      },
    );

    return NextResponse.json({
      generated: inserted.length,
      candidates: candidates.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "通知を生成できませんでした。",
      },
      { status: 500 },
    );
  }
}
