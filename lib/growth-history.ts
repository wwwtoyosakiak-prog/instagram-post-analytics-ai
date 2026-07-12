export type GrowthSnapshot = {
  id: string;
  score: number;
  postCount: number;
  postsPerWeek: number;
  averageViews: number;
  averageEngagementRate: number;
  averageSaveRate: number;
  averageShareRate: number;
  periodFrom: string | null;
  periodTo: string | null;
  createdAt: string;
};

export function calculateGrowthChange(
  current: GrowthSnapshot,
  previous: GrowthSnapshot | null,
) {
  if (!previous) return null;

  return {
    score: current.score - previous.score,
    postsPerWeek:
      Math.round((current.postsPerWeek - previous.postsPerWeek) * 10) / 10,
    averageViews: current.averageViews - previous.averageViews,
    averageEngagementRate:
      Math.round(
        (current.averageEngagementRate - previous.averageEngagementRate) * 10,
      ) / 10,
    averageSaveRate:
      Math.round(
        (current.averageSaveRate - previous.averageSaveRate) * 10,
      ) / 10,
    averageShareRate:
      Math.round(
        (current.averageShareRate - previous.averageShareRate) * 10,
      ) / 10,
  };
}

export function summarizeGrowthChanges(
  change: ReturnType<typeof calculateGrowthChange>,
) {
  if (!change) {
    return {
      improved: [] as string[],
      declined: [] as string[],
      unchanged: [] as string[],
    };
  }

  const metrics = [
    ["成長スコア", change.score],
    ["週あたり投稿数", change.postsPerWeek],
    ["平均表示数", change.averageViews],
    ["平均エンゲージメント率", change.averageEngagementRate],
    ["平均保存率", change.averageSaveRate],
    ["平均シェア率", change.averageShareRate],
  ] as const;

  const improved: string[] = [];
  const declined: string[] = [];
  const unchanged: string[] = [];

  for (const [label, value] of metrics) {
    if (value > 0) improved.push(label);
    else if (value < 0) declined.push(label);
    else unchanged.push(label);
  }

  return { improved, declined, unchanged };
}

export function filterSnapshotsByDays(
  snapshots: GrowthSnapshot[],
  days: number,
  now = new Date(),
) {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - days);

  return snapshots.filter(
    (snapshot) => new Date(snapshot.createdAt) >= threshold,
  );
}
