import { describe, expect, it } from "vitest";
import { summarizeCompetitorPosts } from "@/lib/competitor-benchmark";

describe("summarizeCompetitorPosts", () => {
  it("競合投稿を集計する", () => {
    const result = summarizeCompetitorPosts("c1", [
      {
        id: "1",
        competitorId: "c1",
        postedAt: "2026-07-01",
        postType: "reel",
        hashtags: "#工作 #段ボール",
        likes: 10,
        comments: 2,
        views: 100,
        saves: 4,
        shares: 1,
      },
      {
        id: "2",
        competitorId: "c1",
        postedAt: "2026-07-02",
        postType: "reel",
        hashtags: "#工作",
        likes: 20,
        comments: 4,
        views: 200,
        saves: null,
        shares: null,
      },
    ]);

    expect(result.posts).toBe(2);
    expect(result.averageViews).toBe(150);
    expect(result.topPostType).toBe("reel");
    expect(result.topHashtags[0]).toBe("#工作");
  });
});
