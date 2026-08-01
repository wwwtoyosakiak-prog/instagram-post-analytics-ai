export interface DashboardAccount {
  name: string;
  username: string;
  followers_count: number;
  profile_picture_url: string;
  last_synced_at: string;
}

export interface DashboardTotals {
  posts: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  views: number;
}

export interface DashboardAccountInsightTrendRow {
  date: string;
  reach: number | null;
  impressions: number | null;
  profile_views: number | null;
  website_clicks: number | null;
  follower_count: number | null;
}

export interface DashboardApiResponse {
  configured?: boolean;
  message?: string;
  account?: DashboardAccount | null;
  totals?: DashboardTotals;
  account_insights_trend?: DashboardAccountInsightTrendRow[];
}

export type SyncHistoryRow =
  | {
      kind: "scheduled";
      key: string;
      plannedAt: string;
      executedAt: string;
      sortAtMs: number;
      triggerLabel: "自動";
      statusLabel: string;
      fetchedPostsLabel: string;
      savedPostsLabel: string;
      savedSnapshotsLabel: string;
      errorLabel: string;
    }
  | {
      kind: "manual";
      key: string;
      plannedAt: "手動実行";
      executedAt: string;
      sortAtMs: number;
      triggerLabel: "手動";
      statusLabel: string;
      fetchedPostsLabel: string;
      savedPostsLabel: string;
      savedSnapshotsLabel: string;
      errorLabel: string;
    };

export type GrowthAnalysis = {
  summary: string;
  openingPatterns: string[];
  themes: string[];
  formatPatterns: string[];
  hashtagPatterns: string[];
  nextActions: string[];
};

export type GraphPeriod = "1" | "7" | "14" | "30" | "90" | "365";
