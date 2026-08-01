"use client";

import { InstagramAccount, InstagramPost, InstagramPostInput } from "@/lib/types";

const POSTS_STORAGE_KEY = "instagram-ai-posts-v1";
const ACCOUNTS_STORAGE_KEY = "instagram-ai-accounts-v1";

export function loadPosts(): InstagramPost[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(POSTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InstagramPost[];
  } catch {
    return [];
  }
}

export function savePosts(posts: InstagramPost[]) {
  window.localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
}

export function updatePost(id: string, input: InstagramPostInput) {
  const posts = loadPosts();
  const updated = posts.map((post) => (post.id === id ? { ...post, ...input, updatedAt: new Date().toISOString() } : post));
  savePosts(updated);
  return updated.find((post) => post.id === id) ?? null;
}

export function upsertManyPosts(nextPosts: InstagramPost[]) {
  const current = loadPosts();
  const ids = new Set(current.map((post) => post.id));
  savePosts([...nextPosts.filter((post) => !ids.has(post.id)), ...current]);
}

export function deletePost(id: string) {
  savePosts(loadPosts().filter((post) => post.id !== id));
}

export function loadAccounts(): InstagramAccount[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InstagramAccount[];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: InstagramAccount[]) {
  window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}
