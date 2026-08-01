const MAX_LOG_MESSAGE_LENGTH = 500;

export function redactSensitiveLogText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:access_token|token|api_key|apikey|key|secret|password)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/https?:\/\/[^\s)]+/gi, "[REDACTED_URL]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[REDACTED_ID]")
    .slice(0, MAX_LOG_MESSAGE_LENGTH);
}

export function safeErrorMessage(error: unknown, fallback = "処理に失敗しました。"): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : fallback;
  return redactSensitiveLogText(message || fallback);
}

export function logServerIssue(
  scope: string,
  error: unknown,
  metadata: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error(`[${scope}]`, {
    ...metadata,
    message: safeErrorMessage(error),
  });
}

export function logClientIssue(scope: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  console.warn(`[${scope}] ${safeErrorMessage(error)}`);
}
