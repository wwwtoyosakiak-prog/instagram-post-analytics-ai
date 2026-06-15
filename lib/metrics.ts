import { InstagramPost, PostCategory, PostMetrics, PostType } from "@/lib/types";

export const postTypeLabels: Record<PostType, string> = {
  image: "画像",
  video: "動画",
  reel: "リール",
  carousel: "カルーセル"
};

export const postCategoryLabels: Record<PostCategory, string> = {
  product: "商品紹介",
  howto: "ノウハウ",
  campaign: "キャンペーン",
  voice: "お客様の声",
  recruit: "採用",
  store: "店舗紹介",
  sale: "セール告知",
  brand: "ブランド世界観",
  other: "未分類"
};

export const postCategoryOptions = Object.entries(postCategoryLabels).map(([value, label]) => ({ value: value as PostCategory, label }));

export function getMetrics(post: Pick<InstagramPost, "likes" | "comments" | "saves" | "shares" | "views">): PostMetrics {
  const engagement = post.likes + post.comments + post.saves + post.shares;
  const rate = (value: number) => (post.views > 0 ? (value / post.views) * 100 : 0);
  return {
    engagement,
    engagementRate: rate(engagement),
    saveRate: rate(post.saves),
    commentRate: rate(post.comments)
  };
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function byDateAsc(a: InstagramPost, b: InstagramPost) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

export function weekdayJa(date: string) {
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(`${date}T00:00:00`).getDay()];
}
