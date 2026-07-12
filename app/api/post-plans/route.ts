import { NextRequest, NextResponse } from "next/server";
import type {
  PostPlannerInput,
  PostPlannerResult,
} from "@/lib/post-planner";
import {
  isPostPlanStatus,
  type PostPlanStatus,
} from "@/lib/post-plan-history";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PostPlanRow = {
  id: string;
  title: string;
  status: PostPlanStatus;
  scheduled_date: string | null;
  goal: PostPlannerInput["goal"];
  post_type: PostPlannerInput["postType"];
  theme: string;
  audience: string;
  key_message: string;
  tone: string | null;
  duration: string | null;
  notes: string | null;
  result: PostPlannerResult;
  created_at: string;
  updated_at: string;
};

type CreateBody = {
  input?: PostPlannerInput;
  result?: PostPlannerResult;
  scheduledDate?: string | null;
};

type UpdateBody = {
  id?: string;
  status?: PostPlanStatus;
  scheduledDate?: string | null;
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
    throw new Error((await response.text()) || "Supabase request failed.");
  }

  return response.json() as Promise<T>;
}

function mapRow(row: PostPlanRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    scheduledDate: row.scheduled_date,
    input: {
      goal: row.goal,
      postType: row.post_type,
      theme: row.theme,
      audience: row.audience,
      keyMessage: row.key_message,
      tone: row.tone ?? "",
      duration: row.duration ?? "",
      notes: row.notes ?? "",
    },
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const statusFilter =
    status && status !== "all" && isPostPlanStatus(status)
      ? `&status=eq.${status}`
      : "";

  try {
    const rows = await supabaseRequest<PostPlanRow[]>(
      `ai_post_plans?select=*&order=created_at.desc${statusFilter}`,
    );

    return NextResponse.json({ plans: rows.map(mapRow) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "企画履歴を取得できませんでした。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: CreateBody;

  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.input || !body.result?.title || !body.result.caption) {
    return NextResponse.json(
      { error: "保存する投稿企画が不足しています。" },
      { status: 400 },
    );
  }

  try {
    const rows = await supabaseRequest<PostPlanRow[]>("ai_post_plans", {
      method: "POST",
      body: JSON.stringify({
        title: body.result.title,
        status: "draft",
        scheduled_date: body.scheduledDate || null,
        goal: body.input.goal,
        post_type: body.input.postType,
        theme: body.input.theme,
        audience: body.input.audience,
        key_message: body.input.keyMessage,
        tone: body.input.tone || null,
        duration: body.input.duration || null,
        notes: body.input.notes || null,
        result: body.result,
      }),
    });

    return NextResponse.json({ plan: mapRow(rows[0]) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "投稿企画を保存できませんでした。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  let body: UpdateBody;

  try {
    body = (await request.json()) as UpdateBody;
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

  if (body.status !== undefined && !isPostPlanStatus(body.status)) {
    return NextResponse.json(
      { error: "企画ステータスが正しくありません。" },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status !== undefined) payload.status = body.status;
  if (body.scheduledDate !== undefined) {
    payload.scheduled_date = body.scheduledDate || null;
  }

  try {
    const rows = await supabaseRequest<PostPlanRow[]>(
      `ai_post_plans?id=eq.${encodeURIComponent(body.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return NextResponse.json({ plan: mapRow(rows[0]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "投稿企画を更新できませんでした。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "削除対象のIDが必要です。" },
      { status: 400 },
    );
  }

  try {
    await supabaseRequest<PostPlanRow[]>(
      `ai_post_plans?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "投稿企画を削除できませんでした。" },
      { status: 500 },
    );
  }
}
