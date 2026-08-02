import { logServerIssue } from "@/lib/safe-logging";

function getWebhookUrl(ownerId: string) {
  const userUrls = process.env.SYNC_FAILURE_WEBHOOK_URLS;
  if (userUrls) {
    try {
      const parsed = JSON.parse(userUrls) as Record<string, unknown>;
      if (typeof parsed[ownerId] === "string") return parsed[ownerId] as string;
    } catch {
      return null;
    }
  }
  return ownerId === "owner" ? process.env.SYNC_FAILURE_WEBHOOK_URL ?? null : null;
}

export async function notifySyncFailure(ownerId: string, message: string) {
  const url = getWebhookUrl(ownerId);
  if (!url) return { sent: false, reason: "not_configured" as const };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Instagram投稿分析AI: 同期に失敗しました\n${message}`,
        event: "instagram_sync_failed",
        occurredAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Webhook failed (${response.status})`);
    return { sent: true as const };
  } catch (error) {
    logServerIssue("sync-failure-notification", error);
    return { sent: false, reason: "delivery_failed" as const };
  }
}
