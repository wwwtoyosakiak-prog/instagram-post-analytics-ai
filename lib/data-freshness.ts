export type DataFreshness = { label: string; tone: "fresh" | "aging" | "stale" | "missing"; description: string };

export function getDataFreshness(value?: string | null, now = new Date()): DataFreshness {
  if (!value) return { label: "未同期", tone: "missing", description: "Instagramデータを取得してください。" };
  const syncedAt = new Date(value);
  if (Number.isNaN(syncedAt.getTime())) return { label: "要確認", tone: "missing", description: "同期日時を確認できません。" };
  const ageHours = Math.max(0, (now.getTime() - syncedAt.getTime()) / 3_600_000);
  if (ageHours <= 8) return { label: "最新", tone: "fresh", description: "最新の同期データです。" };
  if (ageHours <= 24) return { label: "本日更新", tone: "aging", description: "本日中に同期されたデータです。" };
  return { label: "更新が必要", tone: "stale", description: "24時間以上更新されていません。" };
}

export function freshnessClass(tone: DataFreshness["tone"]) {
  if (tone === "fresh") return "bg-emerald-50 text-emerald-700";
  if (tone === "aging") return "bg-sky-50 text-sky-700";
  if (tone === "stale") return "bg-amber-50 text-amber-800";
  return "bg-stone-100 text-stone-600";
}
