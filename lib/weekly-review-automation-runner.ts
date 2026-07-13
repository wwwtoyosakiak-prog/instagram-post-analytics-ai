import type { WeeklyReviewAutomationSettings } from "@/lib/weekly-review-automation-settings";

export type AutomationDecision = {
  shouldRun: boolean;
  shouldGenerateAi: boolean;
  status: "run" | "skip";
  reason: string;
};

export function decideWeeklyReviewAutomation(
  settings: WeeklyReviewAutomationSettings,
  trigger: "cron" | "manual",
  daysRecorded: number,
): AutomationDecision {
  if (!settings.enabled) {
    return {
      shouldRun: false,
      shouldGenerateAi: false,
      status: "skip",
      reason: "週次レビュー自動化が無効です。",
    };
  }

  if (trigger === "cron" && settings.manualOnly) {
    return {
      shouldRun: false,
      shouldGenerateAi: false,
      status: "skip",
      reason: "手動実行のみの設定です。",
    };
  }

  if (daysRecorded < settings.minimumRecordedDays) {
    return {
      shouldRun: true,
      shouldGenerateAi: !settings.skipAiWhenInsufficient,
      status: "run",
      reason: settings.skipAiWhenInsufficient
        ? "記録日数が条件未満のため、数値レビューのみ保存します。"
        : "記録日数は条件未満ですが、AI生成を実行します。",
    };
  }

  return {
    shouldRun: true,
    shouldGenerateAi: true,
    status: "run",
    reason: "実行条件を満たしています。",
  };
}
