export type PostType = "image" | "video" | "reel" | "carousel";

export type InstagramAccountInput = {
  name: string;
  username: string;
  profileUrl: string;
  industry: string;
  targetAudience: string;
  goal: string;
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
