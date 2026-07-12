import { NextRequest, NextResponse } from "next/server";
import {
  isPipelinePriority,
  isPipelineStage,
  type PipelinePriority,
  type PipelineStage,
} from "@/lib/content-pipeline";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PipelineRow = {
  id: string;
  title: string;
  pipeline_stage: PipelineStage;
  priority: PipelinePriority;
  assignee: string | null;
  due_date: string | null;
  scheduled_date: string | null;
  post_type: string;
  theme: string;
  result: {
    caption?: string;
  } | null;
  updated_at: string;
};

type PatchBody = {
  id?: string;
  stage?: PipelineStage;
  priority?: PipelinePriority;
  assignee?: string;
  dueDate?: string | null;
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
    throw new Error(
      (await response.text()) || "Supabase request failed.",
    );
  }

  return response.json() as Promise<T>;
}

function mapRow(row: PipelineRow) {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    postType: row.post_type,
    stage: row.pipeline_stage,
    priority: row.priority,
    assignee: row.assignee ?? "",
    dueDate: row.due_date,
    scheduledDate: row.scheduled_date,
    caption: row.result?.caption ?? "",
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const rows = await supabaseRequest<PipelineRow[]>(
      "ai_post_plans?select=id,title,pipeline_stage,priority,assignee,due_date,scheduled_date,post_type,theme,result,updated_at&order=updated_at.desc",
    );

    return NextResponse.json({
      cards: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "パイプラインを取得できませんでした。",
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

  if (body.stage !== undefined && !isPipelineStage(body.stage)) {
    return NextResponse.json(
      { error: "工程が正しくありません。" },
      { status: 400 },
    );
  }

  if (
    body.priority !== undefined &&
    !isPipelinePriority(body.priority)
  ) {
    return NextResponse.json(
      { error: "優先度が正しくありません。" },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.stage !== undefined) {
    payload.pipeline_stage = body.stage;
  }
  if (body.priority !== undefined) {
    payload.priority = body.priority;
  }
  if (body.assignee !== undefined) {
    payload.assignee = body.assignee.trim() || null;
  }
  if (body.dueDate !== undefined) {
    payload.due_date = body.dueDate || null;
  }
  if (body.scheduledDate !== undefined) {
    payload.scheduled_date = body.scheduledDate || null;
  }

  try {
    const rows = await supabaseRequest<PipelineRow[]>(
      `ai_post_plans?id=eq.${encodeURIComponent(body.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    const updated = rows[0];

    if (!updated) {
      throw new Error("更新結果がありません。");
    }

    return NextResponse.json({
      card: mapRow(updated),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "パイプラインを更新できませんでした。",
      },
      { status: 500 },
    );
  }
}
