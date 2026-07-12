export type KpiMetrics = {
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

export type HistoricalPost = KpiMetrics & {
  id: string;
  type: string;
  date: string;
  caption?: string;
};

export type PostKpiPlan = {
  id: string;
  title: string;
  theme: string;
  postType: string;
  scheduledDate: string | null;
  linkedPostId: string | null;
  predicted: KpiMetrics;
  actual: KpiMetrics;
  evaluatedAt: string | null;
};

export type MetricEvaluation = {
  predicted: number;
  actual: number;
  difference: number;
  achievementRate: number | null;
};

export type KpiEvaluation = {
  views: MetricEvaluation;
  likes: MetricEvaluation;
  comments: MetricEvaluation;
  saves: MetricEvaluation;
  shares: MetricEvaluation;
  averageAchievementRate: number | null;
  rating:
    | "not_evaluated"
    | "excellent"
    | "good"
    | "near_target"
    | "below_target";
};

const metricKeys: Array<keyof KpiMetrics> = [
  "views",
  "likes",
  "comments",
  "saves",
  "shares",
];

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function normalizeMetrics(
  value: Partial<KpiMetrics> | null | undefined,
): KpiMetrics {
  return {
    views: nonNegative(value?.views ?? 0),
    likes: nonNegative(value?.likes ?? 0),
    comments: nonNegative(value?.comments ?? 0),
    saves: nonNegative(value?.saves ?? 0),
    shares: nonNegative(value?.shares ?? 0),
  };
}

export function median(values: number[]) {
  if (!values.length) return 0;

  const sorted = values
    .map(nonNegative)
    .sort((a, b) => a - b);

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function buildBaselinePrediction(
  posts: HistoricalPost[],
  postType: string,
  limit = 20,
): {
  prediction: KpiMetrics;
  sampleCount: number;
  basis: "same_type" | "all_posts" | "no_data";
} {
  const sorted = [...posts].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const sameType = sorted
    .filter((post) => post.type === postType)
    .slice(0, limit);

  const sample =
    sameType.length >= 3 ? sameType : sorted.slice(0, limit);

  if (!sample.length) {
    return {
      prediction: normalizeMetrics(null),
      sampleCount: 0,
      basis: "no_data",
    };
  }

  const prediction = metricKeys.reduce<KpiMetrics>(
    (result, key) => {
      result[key] = median(sample.map((post) => post[key]));
      return result;
    },
    normalizeMetrics(null),
  );

  return {
    prediction,
    sampleCount: sample.length,
    basis: sameType.length >= 3 ? "same_type" : "all_posts",
  };
}

export function achievementRate(
  predicted: number,
  actual: number,
): number | null {
  if (predicted <= 0) return actual > 0 ? null : 100;
  return Math.round((actual / predicted) * 1000) / 10;
}

function evaluateMetric(
  predicted: number,
  actual: number,
): MetricEvaluation {
  return {
    predicted,
    actual,
    difference: actual - predicted,
    achievementRate: achievementRate(predicted, actual),
  };
}

export function evaluatePostKpis(
  predictedInput: Partial<KpiMetrics>,
  actualInput: Partial<KpiMetrics>,
): KpiEvaluation {
  const predicted = normalizeMetrics(predictedInput);
  const actual = normalizeMetrics(actualInput);

  const metrics = metricKeys.map((key) => ({
    key,
    evaluation: evaluateMetric(predicted[key], actual[key]),
  }));

  const rates = metrics
    .map((item) => item.evaluation.achievementRate)
    .filter((value): value is number => value !== null);

  const hasActual = metricKeys.some((key) => actual[key] > 0);

  const averageAchievementRate = rates.length
    ? Math.round(
        (rates.reduce((sum, value) => sum + value, 0) /
          rates.length) *
          10,
      ) / 10
    : null;

  let rating: KpiEvaluation["rating"] = "not_evaluated";

  if (hasActual && averageAchievementRate !== null) {
    if (averageAchievementRate >= 120) rating = "excellent";
    else if (averageAchievementRate >= 100) rating = "good";
    else if (averageAchievementRate >= 80) rating = "near_target";
    else rating = "below_target";
  }

  return {
    views: evaluateMetric(predicted.views, actual.views),
    likes: evaluateMetric(predicted.likes, actual.likes),
    comments: evaluateMetric(
      predicted.comments,
      actual.comments,
    ),
    saves: evaluateMetric(predicted.saves, actual.saves),
    shares: evaluateMetric(predicted.shares, actual.shares),
    averageAchievementRate,
    rating,
  };
}
