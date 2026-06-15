import { InstagramAccount, InstagramAccountInput, InstagramPost, InstagramPostInput, PostType } from "@/lib/types";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

type AccountRow = {
  id: string;
  name: string;
  username: string;
  profile_url: string | null;
  industry: string | null;
  target_audience: string | null;
  goal: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type PostRow = {
  id: string;
  account_id: string | null;
  date: string;
  recorded_date: string;
  url: string | null;
  caption: string;
  hashtags: string | null;
  type: PostType;
  media_count: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  memo: string | null;
  screenshot: string | null;
  created_at: string;
  updated_at: string;
};

function assertConfigured() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function mapAccount(row: AccountRow): InstagramAccount {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    profileUrl: row.profile_url ?? "",
    industry: row.industry ?? "",
    targetAudience: row.target_audience ?? "",
    goal: row.goal ?? "",
    memo: row.memo ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function accountToRow(input: InstagramAccountInput) {
  return {
    name: input.name,
    username: input.username,
    profile_url: input.profileUrl,
    industry: input.industry,
    target_audience: input.targetAudience,
    goal: input.goal,
    memo: input.memo
  };
}

function mapPost(row: PostRow): InstagramPost {
  return {
    id: row.id,
    accountId: row.account_id ?? undefined,
    date: row.date,
    recordedDate: row.recorded_date,
    url: row.url ?? "",
    caption: row.caption,
    hashtags: row.hashtags ?? "",
    type: row.type,
    mediaCount: row.media_count,
    likes: row.likes,
    comments: row.comments,
    saves: row.saves,
    shares: row.shares,
    views: row.views,
    memo: row.memo ?? "",
    screenshot: row.screenshot ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function postToRow(input: InstagramPostInput) {
  return {
    account_id: input.accountId || null,
    date: input.date,
    recorded_date: input.recordedDate,
    url: input.url,
    caption: input.caption,
    hashtags: input.hashtags,
    type: input.type,
    media_count: input.mediaCount,
    likes: input.likes,
    comments: input.comments,
    saves: input.saves,
    shares: input.shares,
    views: input.views,
    memo: input.memo,
    screenshot: input.screenshot ?? null
  };
}

export async function listAccountsFromSupabase() {
  const rows = await supabaseRequest<AccountRow[]>("instagram_accounts?select=*&order=created_at.desc");
  return rows.map(mapAccount);
}

export async function createAccountInSupabase(input: InstagramAccountInput) {
  const rows = await supabaseRequest<AccountRow[]>("instagram_accounts", {
    method: "POST",
    body: JSON.stringify(accountToRow(input))
  });
  return mapAccount(rows[0]);
}

export async function updateAccountInSupabase(id: string, input: InstagramAccountInput) {
  const rows = await supabaseRequest<AccountRow[]>(`instagram_accounts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(accountToRow(input))
  });
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function deleteAccountFromSupabase(id: string) {
  await supabaseRequest<void>(`instagram_accounts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function upsertAccountsInSupabase(accounts: InstagramAccount[]) {
  const rows = accounts.map((account) => ({
    id: account.id,
    ...accountToRow(account),
    created_at: account.createdAt,
    updated_at: account.updatedAt
  }));
  const result = await supabaseRequest<AccountRow[]>("instagram_accounts?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return result.map(mapAccount);
}

export async function listPostsFromSupabase() {
  const rows = await supabaseRequest<PostRow[]>("instagram_posts?select=*&order=date.desc");
  return rows.map(mapPost);
}

export async function createPostInSupabase(input: InstagramPostInput) {
  const rows = await supabaseRequest<PostRow[]>("instagram_posts", {
    method: "POST",
    body: JSON.stringify(postToRow(input))
  });
  return mapPost(rows[0]);
}

export async function updatePostInSupabase(id: string, input: InstagramPostInput) {
  const rows = await supabaseRequest<PostRow[]>(`instagram_posts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(postToRow(input))
  });
  return rows[0] ? mapPost(rows[0]) : null;
}

export async function deletePostFromSupabase(id: string) {
  await supabaseRequest<void>(`instagram_posts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function upsertPostsInSupabase(posts: InstagramPost[]) {
  const rows = posts.map((post) => ({
    id: post.id,
    ...postToRow(post),
    created_at: post.createdAt,
    updated_at: post.updatedAt
  }));
  const result = await supabaseRequest<PostRow[]>("instagram_posts?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return result.map(mapPost);
}
