import { NextResponse } from "next/server";
import { logServerIssue } from "@/lib/safe-logging";

const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as Record<string, unknown>;
  } catch {
    throw new ApiRequestError("リクエストの形式が正しくありません。", 400);
  }
}

export async function fetchJsonWithTimeout<T = Record<string, unknown>>(
  input: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    let data: T;
    try {
      data = await response.json() as T;
    } catch {
      throw new ApiRequestError("外部サービスから正しい応答を受け取れませんでした。", 502);
    }
    return { response, data };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new ApiRequestError("外部サービスの応答がタイムアウトしました。もう一度お試しください。", 504);
    }
    throw new ApiRequestError("外部サービスに接続できませんでした。時間をおいてお試しください。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function readUpstreamError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function readOpenAiOutput(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const response = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => typeof item.text === "string" ? item.text : "")
    .join("") ?? "";
}

export function apiErrorResponse(error: unknown, scope: string) {
  if (error instanceof ApiRequestError) {
    if (error.status >= 500) logServerIssue(scope, error, { status: error.status });
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  logServerIssue(scope, error, { status: 500 });
  return NextResponse.json({ error: "処理に失敗しました。もう一度お試しください。" }, { status: 500 });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
