import { describe, expect, it } from "vitest";
import { buildPerformanceReport } from "@/lib/performance-report";
import type { AiScoreHistory, InstagramPost } from "@/lib/types";

function post(id: string, date: string, views: number): InstagramPost {
  return {
    id,
    accountId: "account-1",
    date,
    recordedDate: date,
    url: "",
    caption: "",
    hashtags: "",
    type: "image",
    mediaCount: 1,
    likes: 10,
    comments: 2,
    saves: 4,
    shares: 1,
    views,
    memo: "",
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

function score(postId: string, value: number): AiScoreHistory {
  return {
    id: value,
    postId,
    analysisId: `analysis-${postId}`,
    score: value,
    contentScore: 16,
    visualScore: 15,
    captionScore: 14,
    engagementScore: 13,
    discoverabilityScore: 12,
    createdAt: "2026-07-10T00:00:00.000Z",
  };
}

describe("buildPerformanceReport", () => {
  it("指定期間を集計する", () => {
    const report = buildPerformanceReport({
      posts: [
        post("p1", "2026-07-05", 100),
        post("p2", "2026-07-10", 300),
        post("old", "2026-06-20", 500),
      ],
      scoreHistory: [score("p1", 70), score("p2", 90)],
      period: { from: "2026-07-01", to: "2026-07-31" },
      accountId: "account-1",
    });

    expect(report.totals.posts).toBe(2);
    expect(report.totals.views).toBe(400);
    expect(report.averages.views).toBe(200);
    expect(report.averages.aiScore).toBe(80);
    expect(report.bestPost?.id).toBe("p2");
  });

  it("前期間比較を算出する", () => {
    const report = buildPerformanceReport({
      posts: [
        post("current", "2026-07-10", 200),
        post("previous", "2026-06-20", 100),
      ],
      scoreHistory: [],
      period: { from: "2026-07-01", to: "2026-07-31" },
    });

    expect(report.comparison.views).toBe(100);
  });
});
