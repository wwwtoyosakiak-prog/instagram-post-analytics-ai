import { NextResponse } from "next/server";
import {
  defaultWeeklyReviewAutomationSettings,
  normalizeWeeklyReviewAutomationSettings,
} from "@/lib/weekly-review-automation-settings";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = {
  enabled: boolean;
  manual_only: boolean;
  minimum_recorded_days: number;
  skip_ai_when_insufficient: boolean;
  ai_model: string;
  updated_at: string;
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

export async function GET() {
  try {
    const rows = await request<Row[]>(
      "ai_weekly_review_settings?select=*&id=eq.1&limit=1",
    );

    return NextResponse.json({
      settings: rows[0]
        ? mapRow(rows[0])
        : defaultWeeklyReviewAutomationSettings(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "自動化設定を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(requestObject: Request) {
  let body: unknown;

  try {
    body = await requestObject.json();
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  const settings =
    normalizeWeeklyReviewAutomationSettings(body);
  const now = new Date().toISOString();

  try {
    const rows = await request<Row[]>(
      "ai_weekly_review_settings?on_conflict=id",
      {
        method: "POST",
        body: JSON.stringify({
          id: 1,
          enabled: settings.enabled,
          manual_only: settings.manualOnly,
          minimum_recorded_days:
            settings.minimumRecordedDays,
          skip_ai_when_insufficient:
            settings.skipAiWhenInsufficient,
          ai_model: settings.aiModel,
          updated_at: now,
        }),
      },
    );

    return NextResponse.json({
      settings: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "自動化設定を保存できませんでした。",
      },
      { status: 500 },
    );
  }
}
