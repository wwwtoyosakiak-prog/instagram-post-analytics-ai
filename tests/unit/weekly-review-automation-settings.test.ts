import { describe, expect, it } from "vitest";
import {
  hasEnoughRecordedDays,
  normalizeWeeklyReviewAutomationSettings,
  shouldSkipAutomation,
} from "@/lib/weekly-review-automation-settings";

describe("weekly automation settings", () => {
  it("最低記録日数を0〜7に収める", () => {
    const settings =
      normalizeWeeklyReviewAutomationSettings({
        minimumRecordedDays: 20,
      });

    expect(settings.minimumRecordedDays).toBe(7);
  });

  it("手動のみ設定ではCronをスキップする", () => {
    const settings =
      normalizeWeeklyReviewAutomationSettings({
        enabled: true,
        manualOnly: true,
      });

    expect(
      shouldSkipAutomation(settings, "cron"),
    ).toBe("手動実行のみの設定です。");
  });

  it("記録日数が条件を満たすか判定する", () => {
    const settings =
      normalizeWeeklyReviewAutomationSettings({
        minimumRecordedDays: 4,
      });

    expect(
      hasEnoughRecordedDays(3, settings),
    ).toBe(false);
    expect(
      hasEnoughRecordedDays(4, settings),
    ).toBe(true);
  });
});
