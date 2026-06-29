import { NextResponse } from "next/server";
import { InstagramSyncRun } from "@/lib/types";
import { isCronAuthorized } from "@/lib/instagram-token-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type CronStepResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

type ScheduledSyncStage = "auth" | "full_sync" | "snapshot_sync";

function getStepMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  if ("error" in body && typeof body.error === "string") return body.error;
  if ("message" in body && typeof body.message === "string") return body.message;
  return fallback;
}

async function saveScheduledSyncRun(run: Omit<InstagramSyncRun, "id">) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/instagram_sync_runs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      trigger_type: run.triggerType,
      status: run.status,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      fetched_posts: run.fetchedPosts,
      saved_posts: run.savedPosts,
      saved_snapshots: run.savedSnapshots,
      failed_posts: run.failedPosts,
      api_mode: run.apiMode,
      account_id: run.accountId ?? null,
      account_name: run.accountName ?? null,
      account_username: run.accountUsername ?? null,
      error_summary: run.errorSummary ?? null,
      errors: run.errors
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed: ${response.status}`);
  }
}

async function safeSaveScheduledSyncRun(run: Omit<InstagramSyncRun, "id">) {
  try {
    await saveScheduledSyncRun(run);
  } catch (error) {
    console.error("[instagram-scheduled-sync-run-save]", error);
  }
}

function buildFailureRun(params: {
  startedAt: string;
  finishedAt: string;
  status: "failed" | "partial";
  errorSummary: string;
  errors: Array<{
    stage: ScheduledSyncStage;
    message: string;
  }>;
}) {
  return {
    triggerType: "scheduled" as const,
    status: params.status,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    fetchedPosts: 0,
    savedPosts: 0,
    savedSnapshots: 0,
    failedPosts: params.errors.length,
    apiMode: "cron",
    accountId: undefined,
    accountName: undefined,
    accountUsername: undefined,
    errorSummary: params.errorSummary,
    errors: params.errors
  } satisfies Omit<InstagramSyncRun, "id">;
}

async function callInternalSync(request: Request, path: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 500,
      body: { error: "CRON_SECRETが設定されていません。" }
    } satisfies CronStepResult;
  }

  const response = await fetch(new URL(path, request.url), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`
    },
    cache: "no-store"
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = { error: "レスポンスを読み取れませんでした。" };
  }

  return {
    ok: response.ok,
    status: response.status,
    body
  } satisfies CronStepResult;
}

export async function GET(request: Request) {
  const startedAt = new Date().toISOString();
  const auth = isCronAuthorized(request);
  if (!auth.ok) {
    const finishedAt = new Date().toISOString();
    await safeSaveScheduledSyncRun(buildFailureRun({
      startedAt,
      finishedAt,
      status: "failed",
      errorSummary: auth.message,
      errors: [{ stage: "auth", message: auth.message }]
    }));
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const [fullSyncResult, snapshotSyncResult] = await Promise.all([
    callInternalSync(request, "/api/instagram/full-sync"),
    callInternalSync(request, "/api/instagram/sync")
  ]);

  const ok = fullSyncResult.ok && snapshotSyncResult.ok;
  const status = ok ? 200 : 500;
  const finishedAt = new Date().toISOString();

  if (!ok) {
    const errors: Array<{ stage: ScheduledSyncStage; message: string }> = [];

    if (!fullSyncResult.ok) {
      errors.push({
        stage: "full_sync",
        message: getStepMessage(fullSyncResult.body, `full-sync failed (${fullSyncResult.status})`)
      });
    }

    if (!snapshotSyncResult.ok) {
      errors.push({
        stage: "snapshot_sync",
        message: getStepMessage(snapshotSyncResult.body, `sync failed (${snapshotSyncResult.status})`)
      });
    }

    await safeSaveScheduledSyncRun(buildFailureRun({
      startedAt,
      finishedAt,
      status: fullSyncResult.ok || snapshotSyncResult.ok ? "partial" : "failed",
      errorSummary: errors.map((error) => error.message).join(" / "),
      errors
    }));
  }

  return NextResponse.json(
    {
      ok,
      fullSync: fullSyncResult,
      snapshotSync: snapshotSyncResult
    },
    { status }
  );
}
