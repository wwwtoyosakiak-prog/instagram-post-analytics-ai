const DEFAULT_TIMEOUT_MS = 20_000;

export class ClientApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ClientApiError";
  }
}

function errorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const response = data as { error?: unknown; message?: unknown };
  if (typeof response.error === "string" && response.error.trim()) return response.error;
  if (typeof response.message === "string" && response.message.trim()) return response.message;
  return fallback;
}

export async function requestJson<T>(
  input: string,
  init: RequestInit = {},
  fallbackMessage = "データの取得に失敗しました。",
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ClientApiError("サーバーから正しい応答を受け取れませんでした。", response.status || 502);
    }
    if (!response.ok) throw new ClientApiError(errorMessage(data, fallbackMessage), response.status);
    return data as T;
  } catch (error) {
    if (error instanceof ClientApiError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new ClientApiError("通信がタイムアウトしました。もう一度お試しください。", 408);
    }
    throw new ClientApiError("サーバーに接続できませんでした。時間をおいてお試しください。", 0);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function requestJsonOr<T>(input: string, fallback: T, init: RequestInit = {}): Promise<T> {
  try {
    return await requestJson<T>(input, init);
  } catch {
    return fallback;
  }
}
