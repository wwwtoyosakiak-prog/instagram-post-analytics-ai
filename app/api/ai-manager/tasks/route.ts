import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TaskRow = {
  id: string;
  task_date: string;
  task_key: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  note: string | null;
  updated_at: string;
};

type PatchBody = {
  taskDate?: string;
  taskKey?: string;
  title?: string;
  isCompleted?: boolean;
  note?: string;
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
      Prefer:
        "resolution=merge-duplicates,return=representation",
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

function mapRow(row: TaskRow) {
  return {
    id: row.id,
    taskDate: row.task_date,
    taskKey: row.task_key,
    title: row.title,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    note: row.note ?? "",
    updatedAt: row.updated_at,
  };
}

export async function GET(requestObject: NextRequest) {
  const date =
    requestObject.nextUrl.searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "日付が必要です。" },
      { status: 400 },
    );
  }

  try {
    const rows = await request<TaskRow[]>(
      `ai_manager_task_states?select=*&task_date=eq.${encodeURIComponent(
        date,
      )}&order=updated_at.desc`,
    );

    return NextResponse.json({
      states: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "タスク状態を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(requestObject: Request) {
  let body: PatchBody;

  try {
    body = (await requestObject.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (
    !body.taskDate ||
    !body.taskKey ||
    !body.title ||
    typeof body.isCompleted !== "boolean"
  ) {
    return NextResponse.json(
      { error: "タスク情報が不足しています。" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  try {
    const rows = await request<TaskRow[]>(
      "ai_manager_task_states?on_conflict=task_date,task_key",
      {
        method: "POST",
        body: JSON.stringify({
          task_date: body.taskDate,
          task_key: body.taskKey,
          title: body.title,
          is_completed: body.isCompleted,
          completed_at: body.isCompleted ? now : null,
          note: body.note?.trim() || null,
          updated_at: now,
        }),
      },
    );

    return NextResponse.json({
      state: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "タスク状態を更新できませんでした。",
      },
      { status: 500 },
    );
  }
}
