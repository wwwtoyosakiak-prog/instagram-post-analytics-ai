import { createInstagramOperationLogInSupabase, getInstagramAccessTokenFromSupabase, getLatestInstagramOperationLogFromSupabase, isSupabaseConfigured, listInstagramOperationLogsFromSupabase, upsertInstagramAccessTokenInSupabase } from "@/lib/supabase-admin";
import { InstagramAccessTokenRecord, InstagramAccessTokenStatus, InstagramAccessTokenStorage, InstagramOperationLog, InstagramOperationResult, InstagramWarningLevel } from "@/lib/types";

const TOKEN_PROVIDER = "instagram_graph_api";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_DAYS = 30;
const DANGER_THRESHOLD_DAYS = 7;
const CRON_HOUR_UTC = 21;
const CRON_MINUTE_UTC = 0;

type RefreshTriggerType = "manual" | "scheduled";

type TokenStateInternal = {
  storage: InstagramAccessTokenStorage | null;
  state: InstagramAccessTokenRecord;
  token: string | null;
};

type RefreshResult = {
  ok: boolean;
  refreshed: boolean;
  skipped?: boolean;
  message: string;
  token: InstagramAccessTokenRecord;
};

function getEnvToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN || process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN || null;
}

function maskToken(token: string | null | undefined) {
  if (!token) return "未設定";
  const suffix = token.slice(-4);
  return `${"*".repeat(24)}${suffix}`;
}

function sanitizeMessage(message: string, token?: string | null) {
  let sanitized = message;
  if (token) sanitized = sanitized.split(token).join("[REDACTED]");
  sanitized = sanitized.replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]");
  sanitized = sanitized.replace(/[A-Za-z0-9_\-]{40,}/g, (match) => `${"*".repeat(Math.max(match.length - 4, 0))}${match.slice(-4)}`);
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

function getNextCronRunAt(base = new Date()) {
  const next = new Date(base);
  next.setUTCHours(CRON_HOUR_UTC, CRON_MINUTE_UTC, 0, 0);
  if (next.getTime() <= base.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function computeWarningLevel(remainingDays: number | null, status: InstagramAccessTokenStatus): InstagramWarningLevel {
  if (status === "expired") return "expired";
  if (remainingDays == null) return "normal";
  if (remainingDays < 0) return "expired";
  if (remainingDays < DANGER_THRESHOLD_DAYS) return "danger_7_days";
  if (remainingDays < REFRESH_THRESHOLD_DAYS) return "warning_30_days";
  return "normal";
}

function computeStatus(storage: InstagramAccessTokenStorage | null, source: "database" | "environment" | "missing"): InstagramAccessTokenStatus {
  if (source === "missing") return "missing";
  if (!storage?.expiresAt) return "environment_only";
  const expiresAt = new Date(storage.expiresAt).getTime();
  if (expiresAt <= Date.now()) return "expired";
  if (storage.status === "refresh_failed") return "refresh_failed";
  const remainingDays = getRemainingDays(storage.expiresAt);
  if (remainingDays != null && remainingDays < REFRESH_THRESHOLD_DAYS) return "expiring_soon";
  if (source === "environment") return "environment_only";
  return "active";
}

function getRefreshBlockedReason(storage: InstagramAccessTokenStorage | null, token: string | null) {
  if (!token) return "アクセストークンが未設定です。";
  if (storage?.expiresAt && new Date(storage.expiresAt).getTime() <= Date.now()) {
    return "トークン期限切れのため、再ログインが必要です。";
  }
  if (storage?.lastRefreshedAt) {
    const diff = Date.now() - new Date(storage.lastRefreshedAt).getTime();
    if (diff < ONE_DAY_MS) {
      return "24時間以上経過していないため、まだ更新できません。";
    }
  }
  return null;
}

function getRefreshReason(storage: InstagramAccessTokenStorage | null, token: string | null, status: InstagramAccessTokenStatus, remainingDays: number | null) {
  if (!token) return "アクセストークンが未設定です。";
  if (status === "expired") return "トークン期限切れのため、再ログインが必要です。";
  if (storage?.lastRefreshedAt) {
    const diff = Date.now() - new Date(storage.lastRefreshedAt).getTime();
    if (diff < ONE_DAY_MS) {
      return "24時間以上経過していないため、まだ更新できません。";
    }
  }
  if (remainingDays == null) return "有効期限が未記録のため、初回更新後に自動更新判定を開始します。";
  if (remainingDays < REFRESH_THRESHOLD_DAYS) {
    return "残り日数が30日未満のため、更新対象です。";
  }
  return "残り日数が30日以上あるため、自動更新対象外です。";
}

async function saveTokenRecord(record: InstagramAccessTokenStorage) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase環境変数が未設定のため、トークン状態を保存できません。");
  }
  const saved = await upsertInstagramAccessTokenInSupabase(record);
  return saved ?? record;
}

async function logTokenOperation(params: {
  operationType: "manual_refresh" | "scheduled_refresh" | "status_check" | "cron_run";
  result: InstagramOperationResult;
  message: string;
  errorDetail?: string | null;
  metadata?: Record<string, unknown>;
  token?: string | null;
}) {
  if (!isSupabaseConfigured) return null;
  return createInstagramOperationLogInSupabase({
    domain: "token_management",
    operationType: params.operationType,
    result: params.result,
    message: sanitizeMessage(params.message, params.token),
    errorDetail: params.errorDetail ? sanitizeMessage(params.errorDetail, params.token) : null,
    metadata: params.metadata ?? {}
  });
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

async function buildTokenState(storage: InstagramAccessTokenStorage | null, token: string | null, source: "database" | "environment" | "missing") {
  const status = computeStatus(storage, source);
  const remainingDays = getRemainingDays(storage?.expiresAt);
  const refreshBlockedReason = getRefreshBlockedReason(storage, token);
  const refreshReason = getRefreshReason(storage, token, status, remainingDays);
  const warningLevel = computeWarningLevel(remainingDays, status);
  const recentLogs = isSupabaseConfigured ? await listInstagramOperationLogsFromSupabase("token_management", 20) : [];
  const lastCronRun = isSupabaseConfigured
    ? await getLatestInstagramOperationLogFromSupabase("token_management", "cron_run")
    : null;

  const state: InstagramAccessTokenRecord = {
    provider: TOKEN_PROVIDER,
    maskedToken: maskToken(token),
    source,
    status,
    remainingDays,
    daysRemaining: remainingDays,
    issuedAt: storage?.issuedAt ?? null,
    expiresAt: storage?.expiresAt ?? null,
    lastRefreshedAt: storage?.lastRefreshedAt ?? null,
    nextRefreshAt: storage?.nextRefreshAt ?? null,
    lastError: storage?.lastError ?? null,
    lastCheckedAt: storage?.lastCheckedAt ?? null,
    canRefresh: !refreshBlockedReason,
    refreshReason,
    refreshBlockedReason,
    warningLevel,
    lastCronRunAt: lastCronRun?.createdAt ?? null,
    nextCronRunAt: getNextCronRunAt().toISOString(),
    lastCronResult: lastCronRun?.result ?? null,
    lastCronMessage: lastCronRun?.message ?? null,
    lastCronError: lastCronRun?.errorDetail ?? null,
    recentLogs
  };

  return state;
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

export async function getInstagramAccessTokenState(): Promise<TokenStateInternal> {
  const storage = await ensureTokenStorage();
  const token = storage?.accessToken || getEnvToken();
  const source: InstagramAccessTokenRecord["source"] = storage?.accessToken
    ? "database"
    : token
      ? "environment"
      : "missing";
  const state = await buildTokenState(storage, token, source);

  return { storage, token, state };
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

export async function recordInstagramTokenStatusCheck() {
  const current = await getInstagramAccessTokenState();
  await updateInstagramTokenCheckTimestamp();
  const refreshedState = (await getInstagramAccessTokenState()).state;
  await logTokenOperation({
    operationType: "status_check",
    result: "success",
    message: "Instagramトークン状態を確認しました。",
    metadata: {
      status: refreshedState.status,
      daysRemaining: refreshedState.daysRemaining,
      warningLevel: refreshedState.warningLevel
    },
    token: current.token
  });
  return refreshedState;
}

export async function refreshInstagramAccessToken(triggerType: RefreshTriggerType): Promise<RefreshResult> {
  const current = await getInstagramAccessTokenState();
  const token = current.token;
  const now = new Date();
  const blockedReason = getRefreshBlockedReason(current.storage, token);
  const operationType = triggerType === "scheduled" ? "scheduled_refresh" : "manual_refresh";

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
    await logTokenOperation({
      operationType,
      result: "failed",
      message,
      errorDetail: message,
      token
    });
    return { ok: false, refreshed: false, message, token: (await getInstagramAccessTokenState()).state };
  }

  if (blockedReason) {
    const isExpired = Boolean(current.storage?.expiresAt && new Date(current.storage.expiresAt).getTime() <= Date.now());
    const resultType: InstagramOperationResult = isExpired ? "failed" : "skipped";
    const ok = !isExpired;
    if (current.storage && isSupabaseConfigured) {
      await saveTokenRecord({
        ...current.storage,
        status: computeStatus(current.storage, "database"),
        lastError: isExpired ? blockedReason : null,
        lastCheckedAt: now.toISOString()
      });
    }
    await logTokenOperation({
      operationType,
      result: resultType,
      message: blockedReason,
      errorDetail: isExpired ? blockedReason : null,
      metadata: {
        status: current.state.status,
        daysRemaining: current.state.daysRemaining
      },
      token
    });
    return { ok, refreshed: false, skipped: !isExpired, message: blockedReason, token: (await getInstagramAccessTokenState()).state };
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
      await logTokenOperation({
        operationType,
        result: "failed",
        message: "Instagramトークンの更新に失敗しました。",
        errorDetail: errorMessage,
        metadata: {
          status: current.state.status,
          daysRemaining: current.state.daysRemaining
        },
        token
      });
      return { ok: false, refreshed: false, message: errorMessage, token: (await getInstagramAccessTokenState()).state };
    }

    await storeInstagramAccessToken(data.access_token, data.expires_in);

    const message = triggerType === "scheduled"
      ? "Cron実行でInstagramトークンを更新しました。"
      : "Instagramトークンを更新しました。";
    const refreshedState = (await getInstagramAccessTokenState()).state;
    await logTokenOperation({
      operationType,
      result: "success",
      message,
      metadata: {
        status: refreshedState.status,
        daysRemaining: refreshedState.daysRemaining,
        expiresAt: refreshedState.expiresAt
      },
      token: data.access_token
    });
    return {
      ok: true,
      refreshed: true,
      message,
      token: refreshedState
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
    await logTokenOperation({
      operationType,
      result: "failed",
      message: "Instagramトークン更新中に通信エラーが発生しました。",
      errorDetail: errorMessage,
      metadata: {
        status: current.state.status,
        daysRemaining: current.state.daysRemaining
      },
      token
    });
    return { ok: false, refreshed: false, message: errorMessage, token: (await getInstagramAccessTokenState()).state };
  }
}

export async function maybeRefreshInstagramAccessTokenForCron() {
  const current = await getInstagramAccessTokenState();
  await updateInstagramTokenCheckTimestamp();

  if (current.state.source === "missing") {
    const message = "アクセストークンが未設定です。";
    await logTokenOperation({
      operationType: "cron_run",
      result: "failed",
      message,
      errorDetail: message,
      metadata: { source: current.state.source }
    });
    return {
      ok: false,
      refreshed: false,
      skipped: false,
      message,
      token: (await getInstagramAccessTokenState()).state
    };
  }

  if (current.state.remainingDays == null) {
    const refreshed = await refreshInstagramAccessToken("scheduled");
    await logTokenOperation({
      operationType: "cron_run",
      result: refreshed.ok ? "success" : "failed",
      message: refreshed.message,
      errorDetail: refreshed.ok ? null : refreshed.message,
      metadata: {
        refreshed: refreshed.refreshed,
        skipped: false
      },
      token: current.token
    });
    return { ...refreshed, skipped: false };
  }

  if (current.state.remainingDays >= REFRESH_THRESHOLD_DAYS) {
    const message = `残り${current.state.remainingDays}日のため、今回は更新していません。`;
    await logTokenOperation({
      operationType: "cron_run",
      result: "skipped",
      message,
      metadata: {
        refreshed: false,
        skipped: true,
        daysRemaining: current.state.remainingDays
      },
      token: current.token
    });
    return {
      ok: true,
      refreshed: false,
      skipped: true,
      message,
      token: (await getInstagramAccessTokenState()).state
    };
  }

  const refreshed = await refreshInstagramAccessToken("scheduled");
  await logTokenOperation({
    operationType: "cron_run",
    result: refreshed.ok ? "success" : "failed",
    message: refreshed.message,
    errorDetail: refreshed.ok ? null : refreshed.message,
    metadata: {
      refreshed: refreshed.refreshed,
      skipped: false,
      daysRemaining: current.state.remainingDays
    },
    token: current.token
  });
  return { ...refreshed, skipped: false };
}

export async function recordCronAuthorizationFailure(message: string) {
  await logTokenOperation({
    operationType: "cron_run",
    result: "failed",
    message: "Cron認証に失敗しました。",
    errorDetail: message
  });
}

export async function recordCronExecutionFailure(message: string) {
  await logTokenOperation({
    operationType: "cron_run",
    result: "failed",
    message: "Cron実行に失敗しました。",
    errorDetail: message
  });
}

export function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, status: 500, message: "CRON_SECRETが設定されていません。" };
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401, message: "CRON_SECRETが一致しません。" };
  }
  return { ok: true as const, status: 200, message: "" };
}
