import { NextRequest, NextResponse } from "next/server";
import {
  normalizeRetrospectiveDraft,
  type PostRetrospective,
  type RetrospectiveConfidence,
} from "@/lib/post-retrospective";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RetrospectiveRow = {
  id: string;
  plan_id: string;
  linked_post_id: string | null;
  summary: string;
  positives: string[];
  negatives: string[];
  next_actions: string[];
  hypotheses: string[];
  continue_actions: string[];
  stop_actions: string[];
  confidence: RetrospectiveConfidence;
  created_at: string;
  updated_at: string;
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

function mapRow(row: RetrospectiveRow): PostRetrospective {
  return {
    id: row.id,
    planId: row.plan_id,
    linkedPostId: row.linked_post_id,
    summary: row.summary,
    positives: row.positives ?? [],
    negatives: row.negatives ?? [],
    nextActions: row.next_actions ?? [],
    hypotheses: row.hypotheses ?? [],
    continueActions: row.continue_actions ?? [],
    stopActions: row.stop_actions ?? [],
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(requestObject: NextRequest) {
  const planId =
    requestObject.nextUrl.searchParams.get("planId");

  const filter = planId
    ? `&plan_id=eq.${encodeURIComponent(planId)}`
    : "";

  try {
    const rows = await request<RetrospectiveRow[]>(
      `post_retrospectives?select=*&order=updated_at.desc${filter}`,
    );

    return NextResponse.json({
      retrospectives: rows.map(mapRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "振り返りを取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function POST(requestObject: Request) {
  let body: unknown;

  try {
    body = await requestObject.json();
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  const draft = normalizeRetrospectiveDraft(body);

  if (!draft.planId) {
    return NextResponse.json(
      { error: "投稿企画IDが必要です。" },
      { status: 400 },
    );
  }

  try {
    const rows = await request<RetrospectiveRow[]>(
      "post_retrospectives?on_conflict=plan_id",
      {
        method: "POST",
        headers: {
          Prefer:
            "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          plan_id: draft.planId,
          linked_post_id: draft.linkedPostId,
          summary: draft.summary,
          positives: draft.positives,
          negatives: draft.negatives,
          next_actions: draft.nextActions,
          hypotheses: draft.hypotheses,
          continue_actions: draft.continueActions,
          stop_actions: draft.stopActions,
          confidence: draft.confidence,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    return NextResponse.json({
      retrospective: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "振り返りを保存できませんでした。",
      },
      { status: 500 },
    );
  }
}
