import type { InstagramPost } from "@/lib/types";

export type CompetitorDashboardPost = {
  id: string;
  competitorId: string;
  postedAt: string;
  postType: "image" | "video" | "reel" | "carousel";
  likes: number;
  comments: number;
  views: number;
  saves: number | null;
  shares: number | null;
};

export type DashboardSummary = {
  posts: number;
  averageViews: number;
  engagementRate: number;
  reelRate: number;
  carouselRate: number;
  averageLikes: number;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function summarizeOwnDashboard(posts: InstagramPost[]): DashboardSummary {
  const interactions = posts.map(
    (post) => post.likes + post.comments + post.saves + post.shares,
  );

  return {
    posts: posts.length,
    averageViews: round(average(posts.map((post) => post.views))),
    engagementRate: round(
      average(
        posts.map((post, index) =>
          post.views > 0 ? (interactions[index] / post.views) * 100 : 0,
        ),
      ),
    ),
    reelRate: round(
      posts.length
        ? (posts.filter((post) => post.type === "reel").length / posts.length) * 100
        : 0,
    ),
    carouselRate: round(
      posts.length
        ? (posts.filter((post) => post.type === "carousel").length / posts.length) * 100
        : 0,
    ),
    averageLikes: round(average(posts.map((post) => post.likes))),
  };
}

export function summarizeCompetitorDashboard(
  posts: CompetitorDashboardPost[],
): DashboardSummary {
  const interactions = posts.map(
    (post) =>
      post.likes +
      post.comments +
      (post.saves ?? 0) +
      (post.shares ?? 0),
  );

  return {
    posts: posts.length,
    averageViews: round(average(posts.map((post) => post.views))),
    engagementRate: round(
      average(
        posts.map((post, index) =>
          post.views > 0 ? (interactions[index] / post.views) * 100 : 0,
        ),
      ),
    ),
    reelRate: round(
      posts.length
        ? (posts.filter((post) => post.postType === "reel").length / posts.length) * 100
        : 0,
    ),
    carouselRate: round(
      posts.length
        ? (posts.filter((post) => post.postType === "carousel").length / posts.length) * 100
        : 0,
    ),
    averageLikes: round(average(posts.map((post) => post.likes))),
  };
}

export function dashboardInsight(
  own: DashboardSummary,
  competitor: DashboardSummary,
) {
  const points: string[] = [];

  if (own.engagementRate > competitor.engagementRate) {
    points.push(
      `自アカウントは反応率が競合より${round(
        own.engagementRate - competitor.engagementRate,
      )}ポイント高いです。`,
    );
  } else if (own.engagementRate < competitor.engagementRate) {
    points.push(
      `反応率は競合より${round(
        competitor.engagementRate - own.engagementRate,
      )}ポイント低いため、保存・コメントを促すCTAを見直してください。`,
    );
  }

  if (own.averageViews < competitor.averageViews) {
    points.push(
      `平均表示数は競合より${round(
        competitor.averageViews - own.averageViews,
      )}少ないため、投稿形式と冒頭構成の比較が優先です。`,
    );
  }

  if (own.reelRate < competitor.reelRate) {
    points.push(
      `リール比率は競合より${round(
        competitor.reelRate - own.reelRate,
      )}ポイント低いです。`,
    );
  }

  if (!points.length) {
    points.push("主要指標は競合とほぼ同水準です。投稿テーマ単位で比較してください。");
  }

  return points;
}
