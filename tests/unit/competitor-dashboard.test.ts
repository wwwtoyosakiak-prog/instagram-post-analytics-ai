import { describe, expect, it } from "vitest";
import {
  dashboardInsight,
  summarizeCompetitorDashboard,
} from "@/lib/competitor-dashboard";

describe("competitor dashboard", () => {
  it("競合投稿を集計する", () => {
    const result = summarizeCompetitorDashboard([
      {
        id: "1",
        competitorId: "c1",
        postedAt: "2026-07-01",
        postType: "reel",
        likes: 10,
        comments: 2,
        views: 100,
        saves: 3,
        shares: 1,
      },
      {
        id: "2",
        competitorId: "c1",
        postedAt: "2026-07-02",
        postType: "carousel",
        likes: 20,
        comments: 4,
        views: 300,
        saves: null,
        shares: null,
      },
    ]);

    expect(result.posts).toBe(2);
    expect(result.averageViews).toBe(200);
    expect(result.reelRate).toBe(50);
    expect(result.carouselRate).toBe(50);
  });

  it("差分コメントを返す", () => {
    const comments = dashboardInsight(
      {
        posts: 5,
        averageViews: 200,
        engagementRate: 4,
        reelRate: 20,
        carouselRate: 20,
        averageLikes: 10,
      },
      {
        posts: 10,
        averageViews: 500,
        engagementRate: 8,
        reelRate: 70,
        carouselRate: 20,
        averageLikes: 40,
      },
    );

    expect(comments.join(" ")).toContain("平均表示数");
    expect(comments.join(" ")).toContain("リール比率");
  });
});
