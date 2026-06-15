"use client";

import { ImprovementTask, ImprovementTaskInput, InstagramAccount, InstagramAccountInput, InstagramPost, InstagramPostInput } from "@/lib/types";

const POSTS_STORAGE_KEY = "instagram-ai-posts-v1";
const ACCOUNTS_STORAGE_KEY = "instagram-ai-accounts-v1";
const TASKS_STORAGE_KEY = "instagram-ai-tasks-v1";

export type LocalBackup = {
  exportedAt: string;
  version: 1;
  accounts: InstagramAccount[];
  posts: InstagramPost[];
  tasks?: ImprovementTask[];
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

export function loadTasks(): ImprovementTask[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(TASKS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ImprovementTask[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: ImprovementTask[]) {
  window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

export function addTask(input: ImprovementTaskInput) {
  const now = new Date().toISOString();
  const task: ImprovementTask = {
    ...input,
    id: crypto.randomUUID(),
    completedAt: input.status === "done" ? now : undefined,
    createdAt: now,
    updatedAt: now
  };
  saveTasks([task, ...loadTasks()]);
  return task;
}

export function updateTask(id: string, input: ImprovementTaskInput) {
  const tasks = loadTasks();
  const now = new Date().toISOString();
  const updated = tasks.map((task) => {
    if (task.id !== id) return task;
    return {
      ...task,
      ...input,
      completedAt: input.status === "done" ? task.completedAt ?? now : undefined,
      updatedAt: now
    };
  });
  saveTasks(updated);
  return updated.find((task) => task.id === id) ?? null;
}

export function deleteTask(id: string) {
  saveTasks(loadTasks().filter((task) => task.id !== id));
}

export function upsertManyTasks(nextTasks: ImprovementTask[]) {
  const current = loadTasks();
  const ids = new Set(current.map((task) => task.id));
  saveTasks([...nextTasks.filter((task) => !ids.has(task.id)), ...current]);
}

export function exportLocalBackup(): LocalBackup {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    accounts: loadAccounts(),
    posts: loadPosts(),
    tasks: loadTasks()
  };
}

export function importLocalBackup(backup: LocalBackup) {
  saveAccounts(Array.isArray(backup.accounts) ? backup.accounts : []);
  savePosts(Array.isArray(backup.posts) ? backup.posts : []);
  saveTasks(Array.isArray(backup.tasks) ? backup.tasks : []);
}

export function clearLocalData() {
  saveAccounts([]);
  savePosts([]);
  saveTasks([]);
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
