"use client";

import { exportLocalBackup, importLocalBackup, LocalBackup } from "@/lib/storage";

const PHP_API_BASE = "http://127.0.0.1:8080";

type PhpHealthResponse = {
  ok?: boolean;
  message?: string;
  phpVersion?: string;
};

type PhpSaveResponse = {
  ok?: boolean;
  message?: string;
  counts?: {
    accounts?: number;
    posts?: number;
  };
  updatedAt?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error((data as { message?: string }).message ?? "PHP APIの呼び出しに失敗しました。");
  }
  return data;
}

export async function testPhpBackend() {
  const response = await fetch(`${PHP_API_BASE}/api/health`);
  return readJson<PhpHealthResponse>(response);
}

export async function pushLocalDataToPhp() {
  const backup = exportLocalBackup();
  const response = await fetch(`${PHP_API_BASE}/api/data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(backup)
  });
  return readJson<PhpSaveResponse>(response);
}

export async function pullPhpDataToLocal() {
  const response = await fetch(`${PHP_API_BASE}/api/data`);
  const data = await readJson<Partial<LocalBackup>>(response);
  const backup: LocalBackup = {
    exportedAt: new Date().toISOString(),
    version: 1,
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    posts: Array.isArray(data.posts) ? data.posts : []
  };
  importLocalBackup(backup);
  return backup;
}
