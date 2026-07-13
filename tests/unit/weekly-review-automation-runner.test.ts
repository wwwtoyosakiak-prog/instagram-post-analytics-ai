import { describe, expect, it } from "vitest";
import { decideWeeklyReviewAutomation } from "@/lib/weekly-review-automation-runner";
import type { WeeklyReviewAutomationSettings } from "@/lib/weekly-review-automation-settings";

const base: WeeklyReviewAutomationSettings = {
  enabled: true,
  manualOnly: false,
  minimumRecordedDays: 3,
  skipAiWhenInsufficient: true,
  aiModel: "gpt-4.1-mini",
  updatedAt: "",
};

describe("weekly review automation runner", () => {
  it("無効設定ではスキップする", () => {
    expect(
      decideWeeklyReviewAutomation(
        { ...base, enabled: false },
        "cron",
        7,
      ).shouldRun,
    ).toBe(false);
  });

  it("手動のみ設定ではCronをスキップする", () => {
    expect(
      decideWeeklyReviewAutomation(
        { ...base, manualOnly: true },
        "cron",
        7,
      ).shouldRun,
    ).toBe(false);
  });

  it("記録不足時は数値版だけ実行する", () => {
    const result = decideWeeklyReviewAutomation(
      base,
      "manual",
      2,
    );

    expect(result.shouldRun).toBe(true);
    expect(result.shouldGenerateAi).toBe(false);
  });

  it("条件を満たせばAIまで実行する", () => {
    expect(
      decideWeeklyReviewAutomation(
        base,
        "cron",
        3,
      ).shouldGenerateAi,
    ).toBe(true);
  });
});
