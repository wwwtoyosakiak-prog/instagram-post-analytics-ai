import { NextRequest, NextResponse } from "next/server";
import {
  isScheduleStatus,
  type ScheduleStatus,
} from "@/lib/post-scheduling";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ScheduleRow = {
  id: string;
  title: string;
  theme: string;
  post_type: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  schedule_status: ScheduleStatus;
  timezone: string;
  reminder_enabled: boolean;
  result: {
    caption?: string;
    thumbnailText?: string;
    hashtags?: string[];
  } | null;
  updated_at: string;
};

type PatchBody = {
  id?: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduleStatus?: ScheduleStatus;
  timezone?: string;
  reminderEnabled?: boolean;
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

function mapRow(row: ScheduleRow) {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    postType: row.post_type,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    scheduleStatus: row.schedule_status,
    timezone: row.timezone,
    reminderEnabled: row.reminder_enabled,
    caption: row.result?.caption ?? "",
    thumbnailText: row.result?.thumbnailText ?? "",
    hashtags: Array.isArray(row.result?.hashtags)
      ? row.result.hashtags
      : [],
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const filters: string[] = [];

  if (from) {
    filters.push(
      `scheduled_date=gte.${encodeURIComponent(from)}`,
    );
  }
  if (to) {
    filters.push(
      `scheduled_date=lte.${encodeURIComponent(to)}`,
    );
  }

  const filterQuery = filters.length
    ? `&${filters.join("&")}`
    : "";

  try {
    const rows = await supabaseRequest<ScheduleRow[]>(
      "ai_post_plans?select=id,title,theme,post_type,scheduled_date,scheduled_time,schedule_status,timezone,reminder_enabled,result,updated_at" +
        filterQuery +
        "&order=scheduled_date.asc.nullslast,scheduled_time.asc.nullslast",
    );

    return NextResponse.json({
      posts: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "投稿予定を取得できませんでした。",
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

  if (
    body.scheduleStatus !== undefined &&
    !isScheduleStatus(body.scheduleStatus)
  ) {
    return NextResponse.json(
      { error: "予約状態が正しくありません。" },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.scheduledDate !== undefined) {
    payload.scheduled_date = body.scheduledDate || null;
  }
  if (body.scheduledTime !== undefined) {
    payload.scheduled_time = body.scheduledTime || null;
  }
  if (body.scheduleStatus !== undefined) {
    payload.schedule_status = body.scheduleStatus;
  }
  if (body.timezone !== undefined) {
    payload.timezone = body.timezone || "Asia/Tokyo";
  }
  if (body.reminderEnabled !== undefined) {
    payload.reminder_enabled = body.reminderEnabled;
  }

  try {
    const rows = await supabaseRequest<ScheduleRow[]>(
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
      post: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "投稿予定を更新できませんでした。",
      },
      { status: 500 },
    );
  }
}
