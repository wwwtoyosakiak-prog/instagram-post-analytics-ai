"use client";

import { InstagramAccount, InstagramAccountInput, InstagramPost, InstagramPostInput, MonthlyGoal, MonthlyGoalInput } from "@/lib/types";

const POSTS_STORAGE_KEY = "instagram-ai-posts-v1";
const ACCOUNTS_STORAGE_KEY = "instagram-ai-accounts-v1";
const GOALS_STORAGE_KEY = "instagram-ai-goals-v1";

export type LocalBackup = {
  exportedAt: string;
  version: 1;
  accounts: InstagramAccount[];
  posts: InstagramPost[];
  goals?: MonthlyGoal[];
};

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

export function addPost(input: InstagramPostInput) {
  const now = new Date().toISOString();
  const post: InstagramPost = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  const posts = [post, ...loadPosts()];
  savePosts(posts);
  return post;
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

export function loadGoals(): MonthlyGoal[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(GOALS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MonthlyGoal[];
  } catch {
    return [];
  }
}

export function saveGoals(goals: MonthlyGoal[]) {
  window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}

export function addGoal(input: MonthlyGoalInput) {
  const now = new Date().toISOString();
  const goal: MonthlyGoal = {
    ...input,
    accountId: input.accountId || null,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  saveGoals([goal, ...loadGoals()]);
  return goal;
}

export function updateGoal(id: string, input: MonthlyGoalInput) {
  const goals = loadGoals();
  const updated = goals.map((goal) => (goal.id === id ? { ...goal, ...input, accountId: input.accountId || null, updatedAt: new Date().toISOString() } : goal));
  saveGoals(updated);
  return updated.find((goal) => goal.id === id) ?? null;
}

export function deleteGoal(id: string) {
  saveGoals(loadGoals().filter((goal) => goal.id !== id));
}

export function upsertManyGoals(nextGoals: MonthlyGoal[]) {
  const current = loadGoals();
  const ids = new Set(current.map((goal) => goal.id));
  saveGoals([...nextGoals.filter((goal) => !ids.has(goal.id)), ...current]);
}

export function exportLocalBackup(): LocalBackup {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    accounts: loadAccounts(),
    posts: loadPosts(),
    goals: loadGoals()
  };
}

export function importLocalBackup(backup: LocalBackup) {
  saveAccounts(Array.isArray(backup.accounts) ? backup.accounts : []);
  savePosts(Array.isArray(backup.posts) ? backup.posts : []);
  saveGoals(Array.isArray(backup.goals) ? backup.goals : []);
}

export function clearLocalData() {
  saveAccounts([]);
  savePosts([]);
  saveGoals([]);
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

export function addAccount(input: InstagramAccountInput) {
  const now = new Date().toISOString();
  const account: InstagramAccount = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  const accounts = [account, ...loadAccounts()];
  saveAccounts(accounts);
  return account;
}

export function updateAccount(id: string, input: InstagramAccountInput) {
  const accounts = loadAccounts();
  const updated = accounts.map((account) => (account.id === id ? { ...account, ...input, updatedAt: new Date().toISOString() } : account));
  saveAccounts(updated);
  return updated.find((account) => account.id === id) ?? null;
}

export function deleteAccount(id: string) {
  saveAccounts(loadAccounts().filter((account) => account.id !== id));
}

export function upsertManyAccounts(nextAccounts: InstagramAccount[]) {
  const current = loadAccounts();
  const ids = new Set(current.map((account) => account.id));
  saveAccounts([...nextAccounts.filter((account) => !ids.has(account.id)), ...current]);
}
