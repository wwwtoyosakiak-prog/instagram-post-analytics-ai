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
  likes: number;
  comments: number;
  follows: number;
  profileVisits: number;
  reelAvgWatchTime: number | null;
  reelTotalViewTime: number | null;
  reelClipsReplaysCount: number | null;
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

export type InstagramWarningLevel =
  | "normal"
  | "warning_30_days"
  | "danger_7_days"
  | "expired";

export type InstagramOperationDomain = "token_management" | "data_sync";
export type InstagramOperationType = string;
export type InstagramOperationResult = "success" | "failed" | "skipped";

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

export type InstagramOperationLog = {
  id: string;
  domain: InstagramOperationDomain;
  operationType: InstagramOperationType;
  result: InstagramOperationResult;
  message: string;
  errorDetail?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type InstagramAccessTokenRecord = {
  provider: string;
  maskedToken: string;
  source: "database" | "environment" | "missing";
  status: InstagramAccessTokenStatus;
  remainingDays: number | null;
  daysRemaining: number | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  lastRefreshedAt?: string | null;
  nextRefreshAt?: string | null;
  lastError?: string | null;
  lastCheckedAt?: string | null;
  canRefresh: boolean;
  refreshReason?: string | null;
  refreshBlockedReason?: string | null;
  warningLevel: InstagramWarningLevel;
  lastCronRunAt?: string | null;
  nextCronRunAt?: string | null;
  lastCronResult?: InstagramOperationResult | null;
  lastCronMessage?: string | null;
  lastCronError?: string | null;
  recentLogs: InstagramOperationLog[];
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

export type AiImprovementPriority = "high" | "medium" | "low";
export type AiSuggestionConfidence = "high" | "medium" | "low";

export type AiImprovementDetail = {
  priority: AiImprovementPriority;
  category: string;
  issue: string;
  suggestion: string;
  example: string;
};

export type AiHashtagSuggestion = {
  recommended: string[];
  core: string[];
  niche: string[];
  local: string[];
  remove: string[];
  reason: string;
  copyText: string;
};

export type AiPostingTimeSuggestion = {
  bestDay: string;
  bestTime: string;
  alternatives: string[];
  reason: string;
  confidence: AiSuggestionConfidence;
  evidence: "account_data" | "post_history" | "general_tendency";
};

export type AiCaptionSuggestion = {
  hook: string;
  hookOptions?: string[];
  improvedCaption: string;
  shortVersion: string;
  reelVersion?: string;
  ctaStrongVersion?: string;
  callToAction: string;
  ctaOptions?: string[];
  changes: string[];
  strategy?: string;
};

export type AiScoreBreakdown = {
  total: number;
  content: number;
  visual: number;
  caption: number;
  engagement: number;
  discoverability: number;
  summary: string;
  confidence: AiSuggestionConfidence;
};

export type AiAnalysis = {
  analysisVersion?: 2;
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
  improvementsDetailed?: AiImprovementDetail[];
  hashtagSuggestion?: AiHashtagSuggestion;
  postingTimeSuggestion?: AiPostingTimeSuggestion;
  captionSuggestion?: AiCaptionSuggestion;
  scoreBreakdown?: AiScoreBreakdown;
};

export type AiAnalysisRecord = AiAnalysis & {
  id: string;
  postId: string;
  scoreDelta: number | null;
  createdAt: string;
};

export type AiScoreHistoryInput = {
  postId: string;
  analysisId: string | null;
  score: number;
  contentScore: number | null;
  visualScore: number | null;
  captionScore: number | null;
  engagementScore: number | null;
  discoverabilityScore: number | null;
};

export type AiScoreHistory = AiScoreHistoryInput & {
  id: number;
  createdAt: string;
};

export type PerformanceReportPeriod = {
  from: string;
  to: string;
};

export type PerformanceReportComparison = {
  posts: number | null;
  views: number | null;
  reach: number | null;
  saves: number | null;
  engagementRate: number | null;
  aiScore: number | null;
};

export type PerformanceReport = {
  period: PerformanceReportPeriod;
  previousPeriod: PerformanceReportPeriod;
  accountId: string | null;
  totals: {
    posts: number;
    views: number;
    reach: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
  };
  averages: {
    views: number;
    reach: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    engagementRate: number;
    saveRate: number;
    aiScore: number;
  };
  scoreBreakdown: {
    content: number;
    visual: number;
    caption: number;
    engagement: number;
    discoverability: number;
  };
  bestPost: InstagramPost | null;
  needsWorkPost: InstagramPost | null;
  comparison: PerformanceReportComparison;
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


