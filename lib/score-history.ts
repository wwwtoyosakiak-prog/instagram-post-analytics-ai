import type { AiAnalysis, AiScoreHistoryInput } from "@/lib/types";

export function scoreHistoryFromAnalysis(
  postId: string,
  analysisId: string,
  analysis: AiAnalysis,
): AiScoreHistoryInput {
  const breakdown = analysis.scoreBreakdown;

  return {
    postId,
    analysisId,
    score: analysis.score,
    contentScore: breakdown?.content ?? null,
    visualScore: breakdown?.visual ?? null,
    captionScore: breakdown?.caption ?? null,
    engagementScore: breakdown?.engagement ?? null,
    discoverabilityScore: breakdown?.discoverability ?? null,
  };
}
