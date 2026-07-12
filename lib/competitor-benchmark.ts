export type CompetitorPostMetric = {
  id: string;
  competitorId: string;
  postedAt: string;
  postType: "image" | "video" | "reel" | "carousel";
  hashtags: string;
  likes: number;
  comments: number;
  views: number;
  saves: number | null;
  shares: number | null;
};

export function summarizeCompetitorPosts(
  competitorId: string,
  posts: CompetitorPostMetric[],
) {
  const target = posts.filter((post) => post.competitorId === competitorId);
  const average = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  const round = (value: number) => Math.round(value * 100) / 100;

  const interactions = target.map(
    (post) =>
      post.likes +
      post.comments +
      (post.saves ?? 0) +
      (post.shares ?? 0),
  );

  const typeCounts = new Map<string, number>();
  const hashtagCounts = new Map<string, number>();

  for (const post of target) {
    typeCounts.set(post.postType, (typeCounts.get(post.postType) ?? 0) + 1);

    for (const tag of post.hashtags.split(/\s+/).filter((item) => item.startsWith("#"))) {
      hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    competitorId,
    posts: target.length,
    totalViews: target.reduce((sum, post) => sum + post.views, 0),
    averageViews: round(average(target.map((post) => post.views))),
    averageInteractions: round(average(interactions)),
    engagementRate: round(
      average(
        target.map((post, index) =>
          post.views > 0 ? (interactions[index] / post.views) * 100 : 0,
        ),
      ),
    ),
    topPostType:
      [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    topHashtags: [...hashtagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag),
  };
}
