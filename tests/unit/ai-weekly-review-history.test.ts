import { describe, expect, it } from "vitest";
import {
  compareAiWeeklyReviews,
  type AiWeeklyReviewHistoryItem,
} from "@/lib/ai-weekly-review-history";

function item(
  id: string,
  priority: string,
): AiWeeklyReviewHistoryItem {
  return {
    id,
    weekStart: "2026-07-13",
    weekEnd: "2026-07-19",
    aiModel: "test-model",
    aiGeneratedAt: "2026-07-19T00:00:00Z",
    updatedAt: "2026-07-19T00:00:00Z",
    aiReview: {
      executiveSummary: "総評",
      bestPerformance: {
        title: "強み",
        reason: "理由",
      },
      biggestIssue: {
        title: "課題",
        reason: "理由",
        correctiveAction: "修正",
      },
      nextWeekPriority: {
        title: priority,
        target: "目標",
        reason: "理由",
      },
      actionPlan: [],
      continueActions: [],
      stopActions: [],
      successMetrics: [],
      confidence: "medium",
      limitations: [],
    },
  };
}

describe("AI weekly review history", () => {
  it("同じ重点課題の継続を判定する", () => {
    const result = compareAiWeeklyReviews(
      item("2", "投稿準備"),
      item("1", "投稿準備"),
    );

    expect(result.repeatedPriority).toBe(true);
  });

  it("前回データがない場合を扱う", () => {
    const result = compareAiWeeklyReviews(
      item("2", "投稿準備"),
      null,
    );

    expect(result.previousPriority).toBeNull();
    expect(result.repeatedPriority).toBe(false);
  });
});
