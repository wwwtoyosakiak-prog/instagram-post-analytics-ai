import type { InstagramPost, InstagramSyncRun } from "@/lib/types";
import type { GraphPeriod } from "@/components/dashboard/types";

export const SCHEDULED_SYNC_TIMES_LABEL = "毎日 00:17 / 06:17 / 12:17 / 18:17";
export const SCHEDULED_SYNC_HOURS = [0, 6, 12, 18] as const;

export const fmt = (value: number | null | undefined) =>
  value == null ? "–" : value.toLocaleString("ja-JP");

export function videoTitle(post: InstagramPost) {
  const firstLine = post.caption.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine || `${post.date}の動画投稿`;
}

export function getPostPreview(post: InstagramPost) {
  return post.screenshot || post.thumbnailUrl || post.mediaUrl || "";
}

export function toTokyoDateHour(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: parts.hour };
}

export function toTokyoDateTimeParts(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function toTokyoDateKey(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function filterPostsByPeriod(posts: InstagramPost[], period: GraphPeriod, todayKey: string) {
  const end = new Date(`${todayKey}T00:00:00+09:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (Number(period) - 1));
  const startKey = toTokyoDateKey(start);
  return posts.filter((post) => post.date >= startKey && post.date <= todayKey);
}

export function getNextScheduledSyncTime(now: Date) {
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const next = new Date(jstNow);
  next.setSeconds(0, 0);
  const currentMinutes = next.getHours() * 60 + next.getMinutes();
  const nextSlot = SCHEDULED_SYNC_HOURS.find((hour) => currentMinutes < hour * 60 + 17);
  if (typeof nextSlot === "number") {
    next.setHours(nextSlot, 17, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(SCHEDULED_SYNC_HOURS[0], 17, 0, 0);
  }
  return new Date(next.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

function getLatestExpectedScheduledTime(now: Date) {
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const expected = new Date(jstNow);
  expected.setSeconds(0, 0);
  const currentMinutes = expected.getHours() * 60 + expected.getMinutes();
  const pastSlots = SCHEDULED_SYNC_HOURS.filter((hour) => currentMinutes >= hour * 60 + 17);
  if (pastSlots.length) {
    expected.setHours(pastSlots[pastSlots.length - 1], 17, 0, 0);
  } else {
    expected.setDate(expected.getDate() - 1);
    expected.setHours(SCHEDULED_SYNC_HOURS[SCHEDULED_SYNC_HOURS.length - 1], 17, 0, 0);
  }
  return new Date(expected.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

export function getSyncMonitor(now: Date, latestScheduledFinishedAt?: string) {
  const expectedScheduledAt = getLatestExpectedScheduledTime(now);
  const nextScheduledAt = getNextScheduledSyncTime(now);
  const latestScheduledAtMs = latestScheduledFinishedAt ? new Date(latestScheduledFinishedAt).getTime() : 0;
  const expectedAtMs = expectedScheduledAt.getTime();
  const isDelayed = now.getTime() >= expectedAtMs + 15 * 60 * 1000 && latestScheduledAtMs < expectedAtMs;
  return { expectedScheduledAt, nextScheduledAt, isDelayed };
}

export function shiftTokyoDateKey(dateKey: string, offsetDays: number) {
  const base = new Date(`${dateKey}T00:00:00+09:00`);
  base.setDate(base.getDate() + offsetDays);
  return toTokyoDateKey(base);
}

export function getDateRangeKeys(startKey: string, endKey: string) {
  const keys: string[] = [];
  let currentKey = startKey;
  while (currentKey <= endKey) {
    keys.push(currentKey);
    currentKey = shiftTokyoDateKey(currentKey, 1);
  }
  return keys;
}

export function getPreviousRangeKeys(todayKey: string, days: number) {
  return {
    start: shiftTokyoDateKey(todayKey, -(days * 2) + 1),
    end: shiftTokyoDateKey(todayKey, -days),
  };
}

export function formatDateTimeJst(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatTimeJst(value: string) {
  return new Date(value).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function getScheduledSlotTime(dateKey: string, hour: number) {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:17:00+09:00`);
}

export function getScheduledPlannedLabel(iso: string) {
  const parts = toTokyoDateTimeParts(iso);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const plannedHour = [...SCHEDULED_SYNC_HOURS].reverse().find((hour) => currentMinutes >= hour * 60 + 17);
  const targetDateKey = typeof plannedHour === "number" ? parts.date : shiftTokyoDateKey(parts.date, -1);
  const targetHour = typeof plannedHour === "number" ? plannedHour : SCHEDULED_SYNC_HOURS[SCHEDULED_SYNC_HOURS.length - 1];
  return `${targetDateKey} ${String(targetHour).padStart(2, "0")}:17`;
}

export function getScheduledPlannedAtFromStartedAt(iso: string) {
  const parts = toTokyoDateTimeParts(iso);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const plannedHour = [...SCHEDULED_SYNC_HOURS].reverse().find((hour) => currentMinutes >= hour * 60 + 17);
  const targetDateKey = typeof plannedHour === "number" ? parts.date : shiftTokyoDateKey(parts.date, -1);
  const targetHour = typeof plannedHour === "number" ? plannedHour : SCHEDULED_SYNC_HOURS[SCHEDULED_SYNC_HOURS.length - 1];
  return getScheduledSlotTime(targetDateKey, targetHour);
}

export function formatDelayMinutes(totalMinutes: number) {
  if (totalMinutes < 60) return `${totalMinutes}分`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
}

export function formatOptionalMetric(value: number | null | undefined) {
  return value == null ? "未取得" : value.toLocaleString("ja-JP");
}

export function syncStatusLabel(status: InstagramSyncRun["status"]) {
  if (status === "success") return "成功";
  if (status === "partial") return "一部失敗";
  return "失敗";
}

export function syncCountLabel(value: number, apiMode: string) {
  if (apiMode === "github_actions") return "未取得";
  return `${value.toLocaleString()}件`;
}
