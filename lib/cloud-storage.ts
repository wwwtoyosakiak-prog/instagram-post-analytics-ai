"use client";

import {
  addAccount,
  addGoal,
  addPost,
  addTask,
  deleteAccount,
  deleteGoal,
  deletePost,
  deleteTask,
  loadAccounts,
  loadGoals,
  loadPosts,
  loadTasks,
  saveAccounts,
  saveGoals,
  savePosts,
  saveTasks,
  updateAccount,
  updateGoal,
  updatePost,
  updateTask,
  upsertManyAccounts,
  upsertManyGoals,
  upsertManyPosts,
  upsertManyTasks
} from "@/lib/storage";
import { ImprovementTask, ImprovementTaskInput, InstagramAccount, InstagramAccountInput, InstagramInsightSnapshot, InstagramPost, InstagramPostInput, MonthlyGoal, MonthlyGoalInput } from "@/lib/types";
import { AiAnalysis, AiAnalysisRecord, MonthlyReport, MonthlyReportRecord } from "@/lib/types";

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
  const tasks = loadTasks();
  const goals = loadGoals();
  await upsertAccountsData(accounts);
  await upsertPostsData(posts);
  await upsertTasksData(tasks);
  await upsertGoalsData(goals);
  return { accounts: accounts.length, posts: posts.length, tasks: tasks.length, goals: goals.length };
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

export async function loadLatestInsightData(postId: string): Promise<InstagramInsightSnapshot | null> {
  try {
    const data = await requestJson<{ insight: InstagramInsightSnapshot | null }>(`/api/data/insights?postId=${encodeURIComponent(postId)}`);
    return data.insight;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return null;
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

export async function loadMonthlyReportsData(accountId?: string, month?: string): Promise<MonthlyReportRecord[]> {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", accountId);
  if (month) params.set("month", month);
  try {
    const data = await requestJson<{ reports: MonthlyReportRecord[] }>(`/api/data/monthly-reports?${params.toString()}`);
    return data.reports;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function saveMonthlyReportData(report: MonthlyReport, accountId: string | null, accountName: string): Promise<MonthlyReportRecord | null> {
  try {
    const data = await requestJson<{ report: MonthlyReportRecord }>("/api/data/monthly-reports", {
      method: "POST",
      body: JSON.stringify({ report, accountId, accountName })
    });
    return data.report;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return null;
  }
}

export async function loadTasksData(postId?: string): Promise<ImprovementTask[]> {
  const params = new URLSearchParams();
  if (postId) params.set("postId", postId);
  try {
    const data = await requestJson<{ tasks: ImprovementTask[] }>(`/api/data/tasks?${params.toString()}`);
    if (postId) {
      upsertManyTasks(data.tasks);
    } else {
      saveTasks(data.tasks);
    }
    return data.tasks;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadTasks().filter((task) => !postId || task.postId === postId);
  }
}

export async function addTaskData(input: ImprovementTaskInput) {
  try {
    const data = await requestJson<{ task: ImprovementTask }>("/api/data/tasks", {
      method: "POST",
      body: JSON.stringify({ task: input })
    });
    upsertManyTasks([data.task]);
    return data.task;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return addTask(input);
  }
}

export async function updateTaskData(id: string, input: ImprovementTaskInput) {
  try {
    const data = await requestJson<{ task: ImprovementTask | null }>("/api/data/tasks", {
      method: "PUT",
      body: JSON.stringify({ id, task: input })
    });
    if (data.task) upsertManyTasks([data.task]);
    return data.task;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return updateTask(id, input);
  }
}

export async function deleteTaskData(id: string) {
  try {
    await requestJson<{ ok: true }>(`/api/data/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deleteTask(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    deleteTask(id);
  }
}

export async function upsertTasksData(tasks: ImprovementTask[]) {
  try {
    const data = await requestJson<{ tasks: ImprovementTask[] }>("/api/data/tasks", {
      method: "POST",
      body: JSON.stringify({ tasks })
    });
    upsertManyTasks(data.tasks);
    return data.tasks;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    upsertManyTasks(tasks);
    return tasks;
  }
}

export async function loadGoalsData(accountId?: string, month?: string): Promise<MonthlyGoal[]> {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", accountId);
  if (month) params.set("month", month);
  try {
    const data = await requestJson<{ goals: MonthlyGoal[] }>(`/api/data/goals?${params.toString()}`);
    if (accountId || month) {
      upsertManyGoals(data.goals);
    } else {
      saveGoals(data.goals);
    }
    return data.goals;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadGoals().filter((goal) => (!accountId || goal.accountId === accountId || (accountId === "all" && !goal.accountId)) && (!month || goal.month === month));
  }
}

export async function addGoalData(input: MonthlyGoalInput) {
  try {
    const data = await requestJson<{ goal: MonthlyGoal }>("/api/data/goals", {
      method: "POST",
      body: JSON.stringify({ goal: input })
    });
    upsertManyGoals([data.goal]);
    return data.goal;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return addGoal(input);
  }
}

export async function updateGoalData(id: string, input: MonthlyGoalInput) {
  try {
    const data = await requestJson<{ goal: MonthlyGoal | null }>("/api/data/goals", {
      method: "PUT",
      body: JSON.stringify({ id, goal: input })
    });
    if (data.goal) upsertManyGoals([data.goal]);
    return data.goal;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return updateGoal(id, input);
  }
}

export async function deleteGoalData(id: string) {
  try {
    await requestJson<{ ok: true }>(`/api/data/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deleteGoal(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    deleteGoal(id);
  }
}

export async function upsertGoalsData(goals: MonthlyGoal[]) {
  try {
    const data = await requestJson<{ goals: MonthlyGoal[] }>("/api/data/goals", {
      method: "POST",
      body: JSON.stringify({ goals })
    });
    upsertManyGoals(data.goals);
    return data.goals;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    upsertManyGoals(goals);
    return goals;
  }
}
