"use client";

import {
  addAccount,
  addPost,
  deleteAccount,
  deletePost,
  loadAccounts,
  loadPosts,
  saveAccounts,
  savePosts,
  updateAccount,
  updatePost,
  upsertManyAccounts,
  upsertManyPosts
} from "@/lib/storage";
import { InstagramAccount, InstagramAccountInput, InstagramPost, InstagramPostInput } from "@/lib/types";
import { AiAnalysis, AiAnalysisRecord } from "@/lib/types";

type ServerStatus = {
  mode: "supabase" | "local";
  serverStorageEnabled: boolean;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 501) {
    throw new Error("SERVER_STORAGE_DISABLED");
  }
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

function isServerStorageDisabled(error: unknown) {
  return error instanceof Error && error.message === "SERVER_STORAGE_DISABLED";
}

export async function getServerStorageStatus(): Promise<ServerStatus> {
  try {
    return await requestJson<ServerStatus>("/api/data/status");
  } catch {
    return { mode: "local", serverStorageEnabled: false };
  }
}

export async function loadAccountsData() {
  try {
    const data = await requestJson<{ accounts: InstagramAccount[] }>("/api/data/accounts");
    saveAccounts(data.accounts);
    return data.accounts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadAccounts();
  }
}

export async function loadPostsData() {
  try {
    const data = await requestJson<{ posts: InstagramPost[] }>("/api/data/posts");
    savePosts(data.posts);
    return data.posts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadPosts();
  }
}

export async function addAccountData(input: InstagramAccountInput) {
  try {
    const data = await requestJson<{ account: InstagramAccount }>("/api/data/accounts", {
      method: "POST",
      body: JSON.stringify({ account: input })
    });
    upsertManyAccounts([data.account]);
    return data.account;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return addAccount(input);
  }
}

export async function updateAccountData(id: string, input: InstagramAccountInput) {
  try {
    const data = await requestJson<{ account: InstagramAccount | null }>("/api/data/accounts", {
      method: "PUT",
      body: JSON.stringify({ id, account: input })
    });
    if (data.account) upsertManyAccounts([data.account]);
    return data.account;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return updateAccount(id, input);
  }
}

export async function deleteAccountData(id: string) {
  try {
    await requestJson<{ ok: true }>(`/api/data/accounts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deleteAccount(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    deleteAccount(id);
  }
}

export async function upsertAccountsData(accounts: InstagramAccount[]) {
  try {
    const data = await requestJson<{ accounts: InstagramAccount[] }>("/api/data/accounts", {
      method: "POST",
      body: JSON.stringify({ accounts })
    });
    upsertManyAccounts(data.accounts);
    return data.accounts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    upsertManyAccounts(accounts);
    return accounts;
  }
}

export async function addPostData(input: InstagramPostInput) {
  try {
    const data = await requestJson<{ post: InstagramPost }>("/api/data/posts", {
      method: "POST",
      body: JSON.stringify({ post: input })
    });
    upsertManyPosts([data.post]);
    return data.post;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return addPost(input);
  }
}

export async function updatePostData(id: string, input: InstagramPostInput) {
  try {
    const data = await requestJson<{ post: InstagramPost | null }>("/api/data/posts", {
      method: "PUT",
      body: JSON.stringify({ id, post: input })
    });
    if (data.post) upsertManyPosts([data.post]);
    return data.post;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return updatePost(id, input);
  }
}

export async function deletePostData(id: string) {
  try {
    await requestJson<{ ok: true }>(`/api/data/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deletePost(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    deletePost(id);
  }
}

export async function upsertPostsData(posts: InstagramPost[]) {
  try {
    const data = await requestJson<{ posts: InstagramPost[] }>("/api/data/posts", {
      method: "POST",
      body: JSON.stringify({ posts })
    });
    upsertManyPosts(data.posts);
    return data.posts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    upsertManyPosts(posts);
    return posts;
  }
}

export async function pushLocalBackupToServer() {
  const accounts = loadAccounts();
  const posts = loadPosts();
  await upsertAccountsData(accounts);
  await upsertPostsData(posts);
  return { accounts: accounts.length, posts: posts.length };
}

export async function loadAnalysesData(postId: string): Promise<AiAnalysisRecord[]> {
  try {
    const data = await requestJson<{ analyses: AiAnalysisRecord[] }>(`/api/data/analyses?postId=${encodeURIComponent(postId)}`);
    return data.analyses;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function saveAnalysisData(postId: string, analysis: AiAnalysis): Promise<AiAnalysisRecord | null> {
  try {
    const data = await requestJson<{ analysis: AiAnalysisRecord }>("/api/data/analyses", {
      method: "POST",
      body: JSON.stringify({ postId, analysis })
    });
    return data.analysis;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return null;
  }
}
