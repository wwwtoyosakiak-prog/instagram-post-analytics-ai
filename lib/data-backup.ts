import type { InstagramAccount, InstagramPost } from "@/lib/types";

export type BackupFile = {
  version: 1;
  exportedAt: string;
  accounts: InstagramAccount[];
  posts: InstagramPost[];
};

export function createBackup(accounts: InstagramAccount[], posts: InstagramPost[]): BackupFile {
  return { version: 1, exportedAt: new Date().toISOString(), accounts, posts };
}

export function parseBackup(text: string): BackupFile {
  const value = JSON.parse(text) as Partial<BackupFile>;
  const validAccounts = Array.isArray(value.accounts) && value.accounts.every((account) =>
    account && typeof account.id === "string" && typeof account.name === "string" && typeof account.username === "string");
  const validPosts = Array.isArray(value.posts) && value.posts.every((post) =>
    post && typeof post.id === "string" && typeof post.date === "string" && typeof post.caption === "string");
  if (value.version !== 1 || !validAccounts || !validPosts) throw new Error("Invalid backup file.");
  return value as BackupFile;
}
