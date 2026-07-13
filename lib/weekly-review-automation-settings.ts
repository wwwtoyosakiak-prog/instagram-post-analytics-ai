export type WeeklyReviewAutomationSettings = {
  enabled: boolean;
  manualOnly: boolean;
  minimumRecordedDays: number;
  skipAiWhenInsufficient: boolean;
  aiModel: string;
  updatedAt: string;
};

export function defaultWeeklyReviewAutomationSettings():
  WeeklyReviewAutomationSettings {
  return {
    enabled: true,
    manualOnly: false,
    minimumRecordedDays: 1,
    skipAiWhenInsufficient: true,
    aiModel: "gpt-4.1-mini",
    updatedAt: "",
  };
}

export function normalizeWeeklyReviewAutomationSettings(
  value: unknown,
): WeeklyReviewAutomationSettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const minimumRecordedDays =
    typeof source.minimumRecordedDays === "number"
      ? Math.max(
          0,
          Math.min(
            7,
            Math.round(source.minimumRecordedDays),
          ),
        )
      : 1;

  return {
    enabled:
      typeof source.enabled === "boolean"
        ? source.enabled
        : true,
    manualOnly:
      typeof source.manualOnly === "boolean"
        ? source.manualOnly
        : false,
    minimumRecordedDays,
    skipAiWhenInsufficient:
      typeof source.skipAiWhenInsufficient === "boolean"
        ? source.skipAiWhenInsufficient
        : true,
    aiModel:
      typeof source.aiModel === "string" &&
      source.aiModel.trim()
        ? source.aiModel.trim()
        : "gpt-4.1-mini",
    updatedAt:
      typeof source.updatedAt === "string"
        ? source.updatedAt
        : "",
  };
}

export function shouldSkipAutomation(
  settings: WeeklyReviewAutomationSettings,
  trigger: "cron" | "manual",
) {
  if (!settings.enabled) {
    return "自動化設定が無効です。";
  }

  if (
    trigger === "cron" &&
    settings.manualOnly
  ) {
    return "手動実行のみの設定です。";
  }

  return null;
}

export function hasEnoughRecordedDays(
  daysRecorded: number,
  settings: WeeklyReviewAutomationSettings,
) {
  return (
    daysRecorded >= settings.minimumRecordedDays
  );
}
