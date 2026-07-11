export type SyncCounters = {
  fetchedPosts: number;
  savedPosts: number;
  savedSnapshots: number;
  failedPosts: number;
};

export function getSyncStatus(counters: SyncCounters): "success" | "partial" | "failed" {
  if (counters.failedPosts === 0) return "success";
  if (counters.savedPosts > 0 || counters.savedSnapshots > 0) return "partial";
  return "failed";
}

export function getSyncErrorRate(counters: SyncCounters): number {
  if (counters.fetchedPosts <= 0) return counters.failedPosts > 0 ? 1 : 0;
  return counters.failedPosts / counters.fetchedPosts;
}
