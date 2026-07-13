export type AutomationTrigger = "cron" | "manual";

export type WeeklyReviewRun = {
  id: string;
  triggerType: AutomationTrigger;
  status: "running" | "success" | "failed" | "skipped";
  targetWeekStart: string | null;
  targetWeekEnd: string | null;
  aiModel: string;
  message: string;
  startedAt: string;
  finishedAt: string | null;
};

export function previousWeekReferenceDate(
  today: string,
): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function shouldSkipWeeklyReview(
  daysRecorded: number,
) {
  return daysRecorded === 0;
}

export function automationStatusLabel(
  status: WeeklyReviewRun["status"],
) {
  if (status === "success") return "成功";
  if (status === "failed") return "失敗";
  if (status === "running") return "実行中";
  return "スキップ";
}
