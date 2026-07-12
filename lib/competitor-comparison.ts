export type BenchmarkSummary = {
  posts: number;
  averageViews: number;
  engagementRate: number;
  topPostType: string | null;
};

export type BenchmarkComparison = {
  viewDifference: number;
  engagementDifference: number;
  strongerSide: "self" | "competitor" | "even";
  comment: string;
};

export function compareBenchmarks(
  own: BenchmarkSummary,
  competitor: BenchmarkSummary,
): BenchmarkComparison {
  const viewDifference = Math.round((own.averageViews - competitor.averageViews) * 100) / 100;
  const engagementDifference =
    Math.round((own.engagementRate - competitor.engagementRate) * 100) / 100;

  const ownScore =
    (viewDifference > 0 ? 1 : viewDifference < 0 ? -1 : 0) +
    (engagementDifference > 0 ? 1 : engagementDifference < 0 ? -1 : 0);

  const strongerSide =
    ownScore > 0 ? "self" : ownScore < 0 ? "competitor" : "even";

  let comment = "表示数と反応率はほぼ同水準です。";

  if (strongerSide === "self") {
    comment =
      `自アカウントは平均表示数で${Math.abs(viewDifference)}、` +
      `反応率で${Math.abs(engagementDifference)}ポイントの差があります。強い指標を維持しつつ、競合の投稿形式も参考にしてください。`;
  }

  if (strongerSide === "competitor") {
    comment =
      `競合との差は平均表示数${Math.abs(viewDifference)}、` +
      `反応率${Math.abs(engagementDifference)}ポイントです。競合の最多投稿形式と頻出テーマを次回企画へ反映する余地があります。`;
  }

  return {
    viewDifference,
    engagementDifference,
    strongerSide,
    comment,
  };
}
