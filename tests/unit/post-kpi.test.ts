import { describe, expect, it } from "vitest";
import {
  buildBaselinePrediction,
  evaluatePostKpis,
} from "@/lib/post-kpi";

describe("post KPI evaluation", () => {
  it("同形式投稿の中央値から予測する", () => {
    const result = buildBaselinePrediction(
      [
        {
          id: "1",
          type: "reel",
          date: "2026-07-01",
          views: 100,
          likes: 10,
          comments: 1,
          saves: 3,
          shares: 2,
        },
        {
          id: "2",
          type: "reel",
          date: "2026-07-02",
          views: 300,
          likes: 30,
          comments: 3,
          saves: 9,
          shares: 4,
        },
        {
          id: "3",
          type: "reel",
          date: "2026-07-03",
          views: 200,
          likes: 20,
          comments: 2,
          saves: 6,
          shares: 3,
        },
      ],
      "reel",
    );

    expect(result.prediction.views).toBe(200);
    expect(result.prediction.likes).toBe(20);
    expect(result.basis).toBe("same_type");
  });

  it("予測と実績から達成率を評価する", () => {
    const result = evaluatePostKpis(
      {
        views: 100,
        likes: 10,
        comments: 2,
        saves: 4,
        shares: 2,
      },
      {
        views: 120,
        likes: 12,
        comments: 2,
        saves: 5,
        shares: 3,
      },
    );

    expect(result.views.achievementRate).toBe(120);
    expect(result.rating).toBe("excellent");
  });
});
