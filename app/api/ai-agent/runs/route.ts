import { NextResponse } from "next/server";
import type {
  AiAgentRunStatus,
  AiAgentStep,
  AiAgentTrigger,
} from "@/lib/ai-agent";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = {
  id: string;
  trigger_type: AiAgentTrigger;
  status: AiAgentRunStatus;
  current_step: string | null;
  completed_steps: number;
  failed_steps: number;
  skipped_steps: number;
  total_steps: number;
  duration_ms: number | null;
  message: string | null;
  steps: AiAgentStep[] | null;
  started_at: string;
  finished_at: string | null;
};

export async function GET() {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 },
    );
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/ai_agent_runs?select=*&order=started_at.desc&limit=30`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          (await response.text()) ||
          "AIエージェント履歴を取得できませんでした。",
      },
      { status: 500 },
    );
  }

  const rows = (await response.json()) as Row[];

  return NextResponse.json({
    runs: rows.map((row) => ({
      id: row.id,
      triggerType: row.trigger_type,
      status: row.status,
      currentStep: row.current_step ?? "",
      completedSteps: Number(row.completed_steps),
      failedSteps: Number(row.failed_steps),
      skippedSteps: Number(row.skipped_steps),
      totalSteps: Number(row.total_steps),
      durationMs:
        row.duration_ms === null
          ? null
          : Number(row.duration_ms),
      message: row.message ?? "",
      steps: row.steps ?? [],
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  });
}
