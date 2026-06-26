export type PostType = "image" | "video" | "reel" | "carousel";

export type InstagramAccountInput = {
  name: string;
  username: string;
  instagramApiUsername: string;
  profileUrl: string;
  industry: string;
  targetAudience: string;
  goal: string;
  openaiApiKeyEnvName: string;
  openaiModel: string;
  analysisInstructions: string;
  memo: string;
};

export type InstagramAccount = InstagramAccountInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type InstagramPostInput = {
  accountId?: string;
  date: string;
  recordedDate: string;
  url: string;
  caption: string;
  hashtags: string;
  type: PostType;
  mediaCount: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  memo: string;
  screenshot?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaType?: string;
  instagramUsername?: string;
};

export type InstagramPost = InstagramPostInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  latestInsight?: InstagramInsightSnapshot;
};

export type InstagramInsightSnapshot = {
  id: string;
  postId: string;
  capturedAt: string;
  views: number;
  reach: number;
  saved: number;
  shares: number;
  totalInteractions: number;
  likeCount: number;
  commentsCount: number;
};

export type InstagramSyncTriggerType = "manual" | "scheduled";
export type InstagramSyncRunStatus = "success" | "partial" | "failed";

export type InstagramAccessTokenStatus =
  | "missing"
  | "environment_only"
  | "active"
  | "expiring_soon"
  | "expired"
  | "refresh_failed";

export type InstagramAccessTokenStorage = {
  provider: string;
  accessToken: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  lastRefreshedAt?: string | null;
  nextRefreshAt?: string | null;
  status: InstagramAccessTokenStatus;
  lastError?: string | null;
  lastCheckedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type InstagramAccessTokenRecord = {
  provider: string;
  maskedToken: string;
  source: "database" | "environment" | "missing";
  status: InstagramAccessTokenStatus;
  remainingDays: number | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  lastRefreshedAt?: string | null;
  nextRefreshAt?: string | null;
  lastError?: string | null;
  lastCheckedAt?: string | null;
  canRefresh: boolean;
  refreshBlockedReason?: string | null;
};

export type InstagramSyncRun = {
  id: string;
  triggerType: InstagramSyncTriggerType;
  status: InstagramSyncRunStatus;
  startedAt: string;
  finishedAt: string;
  fetchedPosts: number;
  savedPosts: number;
  savedSnapshots: number;
  failedPosts: number;
  apiMode: string;
  accountId?: string;
  accountName?: string;
  accountUsername?: string;
  errorSummary?: string;
  errors: Array<{
    postId?: string;
    stage: string;
    message: string;
    code?: number;
    subcode?: number;
    traceId?: string;
  }>;
};

export type PostMetrics = {
  engagement: number;
  engagementRate: number;
  saveRate: number;
  commentRate: number;
};

export type AiAnalysis = {
  firstImpression: string;
  imageMessage: string;
  captionClarity: string;
  strengths: string;
  weaknesses: string;
  reason: string;
  improvements: string[];
  nextIdeas: string[];
  hashtags: string[];
  score: number;
};

export type AiAnalysisRecord = AiAnalysis & {
  id: string;
  postId: string;
  scoreDelta: number | null;
  createdAt: string;
};

export type MonthlyReport = {
  month: string;
  totalViews: number;
  averageLikes: number;
  averageSaves: number;
  averageEngagementRate: number;
  topPosts: InstagramPost[];
  needsWorkPosts: InstagramPost[];
  summary: string;
  nextMonthPolicy: string[];
};

export type MonthlyReportRecord = MonthlyReport & {
  id: string;
  accountId: string | null;
  accountName: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyGoalInput = {
  accountId?: string | null;
  month: string;
  targetPosts: number;
  targetViews: number;
  targetSaves: number;
  targetSaveRate: number;
  targetEngagementRate: number;
  memo: string;
};

export type MonthlyGoal = MonthlyGoalInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type ImprovementTaskStatus = "todo" | "doing" | "done";

export type ImprovementTaskInput = {
  postId?: string;
  analysisId?: string;
  title: string;
  status: ImprovementTaskStatus;
  assignee: string;
  dueDate: string;
  memo: string;
};

export type ImprovementTask = ImprovementTaskInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

