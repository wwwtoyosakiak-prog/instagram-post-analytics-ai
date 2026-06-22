import { InstagramInsightSnapshot, InstagramPost } from "@/lib/types";

export type InsightGrowthPost = {
  post: InstagramPost;
  viewsGrowth: number;
  currentViews: number;
};

export type InsightGrowthSummary = {
  days: number;
  startAt: string;
  endAt: string;
  syncedPosts: number;
  baselineViews: number;
  currentViews: number;
  viewsGrowth: number;
  viewsGrowthRate: number;
  reachGrowth: number;
  savedGrowth: number;
  sharesGrowth: number;
  interactionsGrowth: number;
  topPosts: InsightGrowthPost[];
};

export function calculateInsightGrowth(
  posts: InstagramPost[],
  snapshots: InstagramInsightSnapshot[],
  days: number,
  endTime = Date.now()
): InsightGrowthSummary {
  const startTime = endTime - days * 24 * 60 * 60 * 1000;
  const postById = new Map(posts.map((post) => [post.id, post]));
  const snapshotsByPostId = new Map<string, InstagramInsightSnapshot[]>();

  for (const snapshot of snapshots) {
    if (!postById.has(snapshot.postId)) continue;
    const items = snapshotsByPostId.get(snapshot.postId) ?? [];
    items.push(snapshot);
    snapshotsByPostId.set(snapshot.postId, items);
  }

  let baselineViews = 0;
  let currentViews = 0;
  let reachGrowth = 0;
  let savedGrowth = 0;
  let sharesGrowth = 0;
  let interactionsGrowth = 0;
  const topPosts: InsightGrowthPost[] = [];

  for (const [postId, items] of snapshotsByPostId) {
    const ordered = [...items]
      .filter((item) => new Date(item.capturedAt).getTime() <= endTime)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    const inPeriod = ordered.filter((item) => new Date(item.capturedAt).getTime() >= startTime);
    if (!inPeriod.length) continue;

    const beforePeriod = [...ordered].reverse().find((item) => new Date(item.capturedAt).getTime() < startTime);
    const baseline = beforePeriod ?? inPeriod[0];
    const latest = inPeriod[inPeriod.length - 1];
    const post = postById.get(postId);
    if (!post) continue;

    const postViewsGrowth = Math.max(latest.views - baseline.views, 0);
    baselineViews += baseline.views;
    currentViews += latest.views;
    reachGrowth += Math.max(latest.reach - baseline.reach, 0);
    savedGrowth += Math.max(latest.saved - baseline.saved, 0);
    sharesGrowth += Math.max(latest.shares - baseline.shares, 0);
    interactionsGrowth += Math.max(latest.totalInteractions - baseline.totalInteractions, 0);
    topPosts.push({ post, viewsGrowth: postViewsGrowth, currentViews: latest.views });
  }

  const viewsGrowth = Math.max(currentViews - baselineViews, 0);
  return {
    days,
    startAt: new Date(startTime).toISOString(),
    endAt: new Date(endTime).toISOString(),
    syncedPosts: topPosts.length,
    baselineViews,
    currentViews,
    viewsGrowth,
    viewsGrowthRate: baselineViews > 0 ? (viewsGrowth / baselineViews) * 100 : 0,
    reachGrowth,
    savedGrowth,
    sharesGrowth,
    interactionsGrowth,
    topPosts: topPosts.sort((a, b) => b.viewsGrowth - a.viewsGrowth || b.currentViews - a.currentViews).slice(0, 3)
  };
}
