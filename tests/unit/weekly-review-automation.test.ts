import { describe, expect, it } from "vitest";
import {
  previousWeekReferenceDate,
  shouldSkipWeeklyReview,
} from "@/lib/weekly-review-automation";

describe("weekly review automation", () => {
  it("前週を判定する参照日を返す", () => {
    expect(
      previousWeekReferenceDate("2026-07-20"),
    ).toBe("2026-07-19");
  });

  it("記録がない週をスキップする", () => {
    expect(shouldSkipWeeklyReview(0)).toBe(true);
    expect(shouldSkipWeeklyReview(3)).toBe(false);
  });
});
