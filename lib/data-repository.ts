import { InstagramAccount, InstagramAccountInput, InstagramPost, InstagramPostInput } from "@/lib/types";

export type AnalyticsRepository = {
  loadAccounts: () => Promise<InstagramAccount[]>;
  saveAccounts: (accounts: InstagramAccount[]) => Promise<void>;
  addAccount: (input: InstagramAccountInput) => Promise<InstagramAccount>;
  updateAccount: (id: string, input: InstagramAccountInput) => Promise<InstagramAccount | null>;
  deleteAccount: (id: string) => Promise<void>;
  loadPosts: () => Promise<InstagramPost[]>;
  savePosts: (posts: InstagramPost[]) => Promise<void>;
  addPost: (input: InstagramPostInput) => Promise<InstagramPost>;
  updatePost: (id: string, input: InstagramPostInput) => Promise<InstagramPost | null>;
  deletePost: (id: string) => Promise<void>;
};

export type ExternalInsightSource = {
  name: string;
  status: "planned" | "active";
  metrics: string[];
};

export const plannedInsightSources: ExternalInsightSource[] = [
  {
    name: "Instagram / SNS insights API",
    status: "planned",
    metrics: ["reach", "profileAccess", "followerGrowth", "linkClicks"]
  },
  {
    name: "広告・キャンペーン API",
    status: "planned",
    metrics: ["spend", "cpc", "conversion", "campaignName"]
  },
  {
    name: "Sales / CRM API",
    status: "planned",
    metrics: ["inquiries", "sales", "leadSource", "customerSegment"]
  }
];
