export type PostType = "image" | "video" | "reel" | "carousel";
export type PostCategory = "product" | "howto" | "campaign" | "voice" | "recruit" | "store" | "sale" | "brand" | "other";

export type InstagramAccountInput = {
  name: string;
  username: string;
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
  category: PostCategory;
  mediaCount: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  memo: string;
  screenshot?: string;
};

export type InstagramPost = InstagramPostInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
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

export type CategoryAiReportItem = {
  category: string;
  summary: string;
  strength: string;
  weakness: string;
  recommendation: string;
};

export type CategoryAiReport = {
  overall: string;
  items: CategoryAiReportItem[];
};
