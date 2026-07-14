export type AiAgentTrigger = "manual" | "cron";
export type AiAgentStepStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";
export type AiAgentRunStatus =
  | "running"
  | "success"
  | "partial"
  | "failed";

export type AiAgentStep = {
  key: string;
  label: string;
  endpoint: string;
  method: "GET" | "POST";
  required: boolean;
  status: AiAgentStepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  message: string;
};

export type AiAgentRun = {
  id: string;
  triggerType: AiAgentTrigger;
  status: AiAgentRunStatus;
  currentStep: string;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  totalSteps: number;
  durationMs: number | null;
  message: string;
  steps: AiAgentStep[];
  startedAt: string;
  finishedAt: string | null;
};

export const defaultAiAgentSteps = (): AiAgentStep[] => [
  {
    key: "instagram-sync",
    label: "Instagramデータ同期",
    endpoint: "/api/instagram/full-sync",
    method: "POST",
    required: true,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    message: "",
  },
  {
    key: "weekly-review",
    label: "週次レビュー生成",
    endpoint: "/api/cron/weekly-operation-review?manual=1",
    method: "GET",
    required: true,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    message: "",
  },
  {
    key: "notifications",
    label: "通知生成",
    endpoint: "/api/notifications/generate",
    method: "POST",
    required: false,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    message: "",
  },
];

export function summarizeAiAgentSteps(
  steps: AiAgentStep[],
) {
  const completedSteps = steps.filter(
    (step) => step.status === "success",
  ).length;
  const failedSteps = steps.filter(
    (step) => step.status === "failed",
  ).length;
  const skippedSteps = steps.filter(
    (step) => step.status === "skipped",
  ).length;
  const requiredFailure = steps.some(
    (step) => step.required && step.status === "failed",
  );

  let status: AiAgentRunStatus = "success";

  if (requiredFailure) {
    status = completedSteps > 0 ? "partial" : "failed";
  } else if (failedSteps > 0 || skippedSteps > 0) {
    status = "partial";
  }

  return {
    status,
    completedSteps,
    failedSteps,
    skippedSteps,
    totalSteps: steps.length,
  };
}

export function aiAgentStatusLabel(
  status: AiAgentRunStatus,
) {
  if (status === "running") return "実行中";
  if (status === "success") return "成功";
  if (status === "partial") return "一部成功";
  return "失敗";
}

export function aiAgentStepStatusLabel(
  status: AiAgentStepStatus,
) {
  if (status === "pending") return "待機";
  if (status === "running") return "実行中";
  if (status === "success") return "成功";
  if (status === "failed") return "失敗";
  return "スキップ";
}
