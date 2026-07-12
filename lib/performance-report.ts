import type { AiScoreHistory, InstagramPost, PerformanceReport, PerformanceReportPeriod } from "@/lib/types";

type Input = {
  posts: InstagramPost[];
  scoreHistory: AiScoreHistory[];
  period: PerformanceReportPeriod;
  accountId?: string;
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / previous) * 100);
};

function previousPeriod(period: PerformanceReportPeriod): PerformanceReportPeriod {
  const start = new Date(`${period.from}T00:00:00Z`);
  const end = new Date(`${period.to}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return {
    from: previousStart.toISOString().slice(0, 10),
    to: previousEnd.toISOString().slice(0, 10),
  };
}

function latestHistoryByPost(history: AiScoreHistory[]) {
  const latest = new Map<string, AiScoreHistory>();
  for (const item of history) {
    const current = latest.get(item.postId);
    if (!current || current.createdAt < item.createdAt) latest.set(item.postId, item);
  }
  return latest;
}

function aggregate(posts: InstagramPost[], historyByPost: Map<string, AiScoreHistory>) {
  const scored = posts
    .map((post) => historyByPost.get(post.id))
    .filter((item): item is AiScoreHistory => Boolean(item));

  const dimension = (key: keyof AiScoreHistory) =>
    average(
      scored
        .map((item) => item[key])
        .filter((value): value is number => typeof value === "number"),
    );

  const engagementRates = posts.map((post) =>
    post.views > 0
      ? ((post.likes + post.comments + post.saves + post.shares) / post.views) * 100
      : 0,
  );
  const saveRates = posts.map((post) =>
    post.views > 0 ? (post.saves / post.views) * 100 : 0,
  );

  return {
    totals: {
      posts: posts.length,
      views: posts.reduce((sum, post) => sum + post.views, 0),
      reach: posts.reduce((sum, post) => sum + (post.latestInsight?.reach ?? 0), 0),
      likes: posts.reduce((sum, post) => sum + post.likes, 0),
      comments: posts.reduce((sum, post) => sum + post.comments, 0),
      saves: posts.reduce((sum, post) => sum + post.saves, 0),
      shares: posts.reduce((sum, post) => sum + post.shares, 0),
    },
    averages: {
      views: round(average(posts.map((post) => post.views))),
      reach: round(average(posts.map((post) => post.latestInsight?.reach ?? 0))),
      likes: round(average(posts.map((post) => post.likes))),
      comments: round(average(posts.map((post) => post.comments))),
      saves: round(average(posts.map((post) => post.saves))),
      shares: round(average(posts.map((post) => post.shares))),
      engagementRate: round(average(engagementRates)),
      saveRate: round(average(saveRates)),
      aiScore: round(average(scored.map((item) => item.score)), 1),
    },
    scoreBreakdown: {
      content: round(dimension("contentScore"), 1),
      visual: round(dimension("visualScore"), 1),
      caption: round(dimension("captionScore"), 1),
      engagement: round(dimension("engagementScore"), 1),
      discoverability: round(dimension("discoverabilityScore"), 1),
    },
  };
}

export function buildPerformanceReport({ posts, scoreHistory, period, accountId }: Input): PerformanceReport {
  const accountPosts = accountId ? posts.filter((post) => post.accountId === accountId) : posts;
  const inRange = (date: string, range: PerformanceReportPeriod) =>
    date >= range.from && date <= range.to;

  const currentPosts = accountPosts.filter((post) => inRange(post.date, period));
  const previous = previousPeriod(period);
  const previousPosts = accountPosts.filter((post) => inRange(post.date, previous));
  const historyByPost = latestHistoryByPost(scoreHistory);
  const current = aggregate(currentPosts, historyByPost);
  const prior = aggregate(previousPosts, historyByPost);
  const sorted = [...currentPosts].sort((a, b) => b.views - a.views);

  return {
    period,
    previousPeriod: previous,
    accountId: accountId ?? null,
    ...current,
    bestPost: sorted[0] ?? null,
    needsWorkPost: sorted.at(-1) ?? null,
    comparison: {
      posts: percentChange(current.totals.posts, prior.totals.posts),
      views: percentChange(current.totals.views, prior.totals.views),
      reach: percentChange(current.totals.reach, prior.totals.reach),
      saves: percentChange(current.totals.saves, prior.totals.saves),
      engagementRate: percentChange(current.averages.engagementRate, prior.averages.engagementRate),
      aiScore: percentChange(current.averages.aiScore, prior.averages.aiScore),
    },
  };
}
