import { NextRequest, NextResponse } from "next/server";
import {
  defaultAiAgentSteps,
  summarizeAiAgentSteps,
  type AiAgentStep,
  type AiAgentTrigger,
} from "@/lib/ai-agent";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

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
        Prefer: "return=representation",
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

function getTrigger(request: NextRequest): AiAgentTrigger {
  return request.nextUrl.searchParams.get("cron") === "1"
    ? "cron"
    : "manual";
}

function isAuthorized(request: NextRequest) {
  if (!cronSecret) return false;

  return (
    request.headers.get("authorization") ===
    `Bearer ${cronSecret}`
  );
}

async function createRun(
  triggerType: AiAgentTrigger,
  steps: AiAgentStep[],
) {
  const rows = await supabaseRequest<RunRow[]>(
    "ai_agent_runs",
    {
      method: "POST",
      body: JSON.stringify({
        trigger_type: triggerType,
        status: "running",
        current_step: "",
        total_steps: steps.length,
        message: "AIエージェントを開始しました。",
        steps,
      }),
    },
  );

  return rows[0]?.id;
}

async function updateRun(
  id: string,
  values: Record<string, unknown>,
) {
  await supabaseRequest<RunRow[]>(
    `ai_agent_runs?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(values),
    },
  );
}

async function executeStep(
  request: NextRequest,
  step: AiAgentStep,
) {
  const startedAt = new Date();
  const headers: HeadersInit = {};

  if (step.endpoint.includes("/api/cron/")) {
    headers.Authorization =
      request.headers.get("authorization") ?? "";
  }

  const response = await fetch(
    new URL(step.endpoint, request.url),
    {
      method: step.method,
      headers,
      cache: "no-store",
    },
  );

  let message = "";

  try {
    const data = await response.json();
    message =
      data.message ??
      data.reason ??
      data.error ??
      (response.ok ? "完了しました。" : "失敗しました。");
  } catch {
    message = response.ok
      ? "完了しました。"
      : `HTTP ${response.status}`;
  }

  const finishedAt = new Date();

  return {
    ok: response.ok,
    message,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs:
      finishedAt.getTime() - startedAt.getTime(),
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const triggerType = getTrigger(request);
  const steps = defaultAiAgentSteps();
  const startedAt = new Date();
  let runId = "";

  try {
    runId = (await createRun(triggerType, steps)) ?? "";

    if (!runId) {
      throw new Error("実行ログを作成できませんでした。");
    }

    let stopRequiredSteps = false;

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];

      if (stopRequiredSteps) {
        steps[index] = {
          ...step,
          status: "skipped",
          message:
            "前の必須工程が失敗したためスキップしました。",
        };
        continue;
      }

      steps[index] = {
        ...step,
        status: "running",
        startedAt: new Date().toISOString(),
      };

      await updateRun(runId, {
        current_step: step.key,
        steps,
      });

      const result = await executeStep(
        request,
        steps[index],
      );

      steps[index] = {
        ...steps[index],
        status: result.ok ? "success" : "failed",
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationMs: result.durationMs,
        message: result.message,
      };

      if (!result.ok && step.required) {
        stopRequiredSteps = true;
      }
    }

    const summary = summarizeAiAgentSteps(steps);
    const finishedAt = new Date();
    const message =
      summary.status === "success"
        ? "すべての工程が完了しました。"
        : summary.status === "partial"
          ? "一部の工程が完了しませんでした。"
          : "AIエージェントの実行に失敗しました。";

    await updateRun(runId, {
      status: summary.status,
      current_step: "",
      completed_steps: summary.completedSteps,
      failed_steps: summary.failedSteps,
      skipped_steps: summary.skippedSteps,
      total_steps: summary.totalSteps,
      duration_ms:
        finishedAt.getTime() - startedAt.getTime(),
      message,
      steps,
      finished_at: finishedAt.toISOString(),
    });

    return NextResponse.json({
      runId,
      status: summary.status,
      message,
      steps,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "AIエージェントの実行に失敗しました。";

    if (runId) {
      await updateRun(runId, {
        status: "failed",
        message,
        steps,
        duration_ms:
          Date.now() - startedAt.getTime(),
        finished_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
