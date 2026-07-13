import type { AiWeeklyReviewResult } from "@/lib/ai-weekly-review";

export type AiWeeklyReviewHistoryItem = {
  id: string;
  weekStart: string;
  weekEnd: string;
  aiReview: AiWeeklyReviewResult;
  aiModel: string;
  aiGeneratedAt: string;
  updatedAt: string;
};

export function compareAiWeeklyReviews(
  current: AiWeeklyReviewHistoryItem,
  previous: AiWeeklyReviewHistoryItem | null,
) {
  const currentPriority =
    current.aiReview.nextWeekPriority.title;

  if (!previous) {
    return {
      currentPriority,
      previousPriority: null,
      repeatedPriority: false,
    };
  }

  const previousPriority =
    previous.aiReview.nextWeekPriority.title;

  return {
    currentPriority,
    previousPriority,
    repeatedPriority:
      currentPriority.trim().toLowerCase() ===
      previousPriority.trim().toLowerCase(),
  };
}
