import { getInstagramAccessTokenFromSupabase, isSupabaseConfigured, upsertInstagramAccessTokenInSupabase } from "@/lib/supabase-admin";
import { InstagramAccessTokenRecord, InstagramAccessTokenStatus, InstagramAccessTokenStorage } from "@/lib/types";

const TOKEN_PROVIDER = "instagram_graph_api";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_DAYS = 30;

type RefreshTriggerType = "manual" | "scheduled";

type TokenStateInternal = {
  storage: InstagramAccessTokenStorage | null;
  state: InstagramAccessTokenRecord;
  token: string | null;
};

type RefreshResult = {
  ok: boolean;
  refreshed: boolean;
  message: string;
  token: InstagramAccessTokenRecord;
};

function getEnvToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN || process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN || null;
}

function maskToken(token: string | null | undefined) {
  if (!token) return "未設定";
  const suffix = token.slice(-4);
  return `${"*".repeat(Math.max(24, token.length - 4))}${suffix}`;
}

function sanitizeMessage(message: string, token?: string | null) {
  let sanitized = message;
  if (token) sanitized = sanitized.split(token).join("[REDACTED]");
  sanitized = sanitized.replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]");
  return sanitized;
}

function getRemainingDays(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.floor(diff / ONE_DAY_MS);
}

function getNextRefreshAt(expiresAt: Date) {
  return new Date(expiresAt.getTime() - REFRESH_THRESHOLD_DAYS * ONE_DAY_MS);
}

function computeStatus(storage: InstagramAccessTokenStorage | null, source: "database" | "environment" | "missing"): InstagramAccessTokenStatus {
  if (source === "missing") return "missing";
  const expiresAt = storage?.expiresAt ? new Date(storage.expiresAt).getTime() : null;
  if (expiresAt != null && expiresAt <= Date.now()) return "expired";
  if (storage?.status === "refresh_failed") return "refresh_failed";
  const remainingDays = getRemainingDays(storage?.expiresAt);
  if (remainingDays != null && remainingDays < REFRESH_THRESHOLD_DAYS) return "expiring_soon";
  if (source === "environment") return "environment_only";
  return "active";
}

function getRefreshBlockedReason(storage: InstagramAccessTokenStorage | null, token: string | null) {
  if (!token) return "アクセストークンが未設定です。";
  if (storage?.expiresAt && new Date(storage.expiresAt).getTime() <= Date.now()) {
    return "トークンの有効期限が切れています。再ログインして長期トークンを再取得してください。";
  }
  if (storage?.lastRefreshedAt) {
    const diff = Date.now() - new Date(storage.lastRefreshedAt).getTime();
    if (diff < ONE_DAY_MS) {
      return "前回更新から24時間経過していないため、まだ更新できません。";
    }
  }
  return null;
}

async function saveTokenRecord(record: InstagramAccessTokenStorage) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase環境変数が未設定のため、トークン状態を保存できません。");
  }
  const saved = await upsertInstagramAccessTokenInSupabase(record);
  return saved ?? record;
}

export async function storeInstagramAccessToken(accessToken: string, expiresInSeconds: number, options?: { status?: InstagramAccessTokenStatus; clearError?: boolean }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);
  const nextRefreshAt = getNextRefreshAt(expiresAt);
  const current = await ensureTokenStorage();
  const saved = await saveTokenRecord({
    provider: TOKEN_PROVIDER,
    accessToken,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastRefreshedAt: now.toISOString(),
    nextRefreshAt: nextRefreshAt.toISOString(),
    status: options?.status ?? "active",
    lastError: options?.clearError === false ? current?.lastError ?? null : null,
    lastCheckedAt: now.toISOString(),
    createdAt: current?.createdAt,
    updatedAt: current?.updatedAt
  });
  return saved;
}

async function ensureTokenStorage() {
  const existing = isSupabaseConfigured
    ? await getInstagramAccessTokenFromSupabase(TOKEN_PROVIDER)
    : null;
  if (existing) return existing;

  const envToken = getEnvToken();
  if (!envToken || !isSupabaseConfigured) return existing;

  return saveTokenRecord({
    provider: TOKEN_PROVIDER,
    accessToken: envToken,
    issuedAt: null,
    expiresAt: null,
    lastRefreshedAt: null,
    nextRefreshAt: null,
    status: "environment_only",
    lastError: null,
    lastCheckedAt: new Date().toISOString()
  });
}

export async function getInstagramAccessTokenState(): Promise<TokenStateInternal> {
  const storage = await ensureTokenStorage();
  const token = storage?.accessToken || getEnvToken();
  const source: InstagramAccessTokenRecord["source"] = storage?.accessToken
    ? "database"
    : token
      ? "environment"
      : "missing";
  const status = computeStatus(storage, source);
  const refreshBlockedReason = getRefreshBlockedReason(storage, token);

  return {
    storage,
    token,
    state: {
      provider: TOKEN_PROVIDER,
      maskedToken: maskToken(token),
      source,
      status,
      remainingDays: getRemainingDays(storage?.expiresAt),
      issuedAt: storage?.issuedAt ?? null,
      expiresAt: storage?.expiresAt ?? null,
      lastRefreshedAt: storage?.lastRefreshedAt ?? null,
      nextRefreshAt: storage?.nextRefreshAt ?? null,
      lastError: storage?.lastError ?? null,
      lastCheckedAt: storage?.lastCheckedAt ?? null,
      canRefresh: !refreshBlockedReason,
      refreshBlockedReason
    }
  };
}

export async function getInstagramAccessTokenForServer() {
  const { token } = await getInstagramAccessTokenState();
  if (!token) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN が設定されていません。");
  }
  return token;
}

export async function updateInstagramTokenCheckTimestamp() {
  const current = await ensureTokenStorage();
  if (!current || !isSupabaseConfigured) return current;
  return saveTokenRecord({
    ...current,
    status: computeStatus(current, "database"),
    lastCheckedAt: new Date().toISOString()
  });
}

export async function refreshInstagramAccessToken(triggerType: RefreshTriggerType): Promise<RefreshResult> {
  const current = await getInstagramAccessTokenState();
  const token = current.token;
  const now = new Date();
  const blockedReason = getRefreshBlockedReason(current.storage, token);

  if (!token) {
    const message = "アクセストークンが未設定です。Vercel環境変数または保存済みトークンを確認してください。";
    if (current.storage && isSupabaseConfigured) {
      await saveTokenRecord({
        ...current.storage,
        status: "missing",
        lastError: message,
        lastCheckedAt: now.toISOString()
      });
    }
    return { ok: false, refreshed: false, message, token: (await getInstagramAccessTokenState()).state };
  }

  if (blockedReason) {
    if (current.storage && isSupabaseConfigured) {
      await saveTokenRecord({
        ...current.storage,
        status: computeStatus(current.storage, "database"),
        lastError: current.storage.expiresAt && new Date(current.storage.expiresAt).getTime() <= Date.now() ? blockedReason : null,
        lastCheckedAt: now.toISOString()
      });
    }
    return { ok: false, refreshed: false, message: blockedReason, token: (await getInstagramAccessTokenState()).state };
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);

  try {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json() as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!response.ok || !data.access_token || !data.expires_in || data.error) {
      const errorMessage = sanitizeMessage(data.error?.message || "Instagramトークンの更新に失敗しました。", token);
      if (current.storage && isSupabaseConfigured) {
        await saveTokenRecord({
          ...current.storage,
          status: "refresh_failed",
          lastError: errorMessage,
          lastCheckedAt: now.toISOString()
        });
      }
      return { ok: false, refreshed: false, message: errorMessage, token: (await getInstagramAccessTokenState()).state };
    }

    await storeInstagramAccessToken(data.access_token, data.expires_in);

    const message = triggerType === "scheduled"
      ? "Cron実行でInstagramトークンを更新しました。"
      : "Instagramトークンを更新しました。";
    return {
      ok: true,
      refreshed: true,
      message,
      token: (await getInstagramAccessTokenState()).state
    };
  } catch (error) {
    const errorMessage = sanitizeMessage(error instanceof Error ? error.message : "Instagramトークン更新中に通信エラーが発生しました。", token);
    if (current.storage && isSupabaseConfigured) {
      await saveTokenRecord({
        ...current.storage,
        status: "refresh_failed",
        lastError: errorMessage,
        lastCheckedAt: now.toISOString()
      });
    }
    return { ok: false, refreshed: false, message: errorMessage, token: (await getInstagramAccessTokenState()).state };
  }
}

export async function maybeRefreshInstagramAccessTokenForCron() {
  const current = await getInstagramAccessTokenState();
  await updateInstagramTokenCheckTimestamp();

  if (current.state.source === "missing") {
    return {
      ok: false,
      refreshed: false,
      skipped: false,
      message: "アクセストークンが未設定です。",
      token: (await getInstagramAccessTokenState()).state
    };
  }

  if (current.state.remainingDays == null) {
    return refreshInstagramAccessToken("scheduled");
  }

  if (current.state.remainingDays >= REFRESH_THRESHOLD_DAYS) {
    return {
      ok: true,
      refreshed: false,
      skipped: true,
      message: `残り${current.state.remainingDays}日のため、今回は更新していません。`,
      token: (await getInstagramAccessTokenState()).state
    };
  }

  const refreshed = await refreshInstagramAccessToken("scheduled");
  return { ...refreshed, skipped: false };
}

export function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, status: 500, message: "CRON_SECRETが設定されていません。" };
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  return { ok: true as const, status: 200, message: "" };
}
