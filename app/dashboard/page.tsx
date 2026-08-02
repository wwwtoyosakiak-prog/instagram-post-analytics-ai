'use client';

import Image from "next/image";
import { useMemo, useState } from "react";
import { ActionError, EmptyState, PageHeader, Panel } from "@/components/ui";
import {
  InstagramInsightSnapshot,
  PostType,
} from "@/lib/types";
import { average, getMetrics, postTypeLabels, weekdayJa } from "@/lib/metrics";
import { calculateInsightGrowth } from "@/lib/insight-growth";
import { mergePostMetrics, matchPostToMedia } from "@/lib/post-merge";
import type {
  DashboardAccountInsightTrendRow,
  GraphPeriod,
  GrowthAnalysis,
  SyncHistoryRow,
} from "@/components/dashboard/types";
import {
  CompareStat,
  GraphPeriodTabs,
  HeroStat,
  Insight,
  MiniMetric,
  SectionLead,
  SyncInfoRow,
} from "@/components/dashboard/widgets";
import { DashboardCharts, HourlyInsightPanel, PeriodGrowthSection } from "@/components/dashboard/analysis-sections";
import { VideoRankingSection, type VideoRankingPeriod } from "@/components/dashboard/video-ranking-section";
import {
  SCHEDULED_SYNC_TIMES_LABEL,
  SCHEDULED_SYNC_HOURS,
  currentMonth,
  filterPostsByPeriod,
  fmt,
  formatDateTimeJst,
  formatDelayMinutes,
  formatOptionalMetric,
  formatTimeJst,
  getDateRangeKeys,
  getPreviousRangeKeys,
  getScheduledPlannedAtFromStartedAt,
  getScheduledPlannedLabel,
  getScheduledSlotTime,
  getSyncMonitor,
  shiftTokyoDateKey,
  syncCountLabel,
  syncStatusLabel,
  toTokyoDateHour,
  toTokyoDateKey,
  toTokyoDateTimeParts,
  videoTitle,
} from "@/components/dashboard/utils";
import { useDashboardSync } from "@/components/dashboard/use-dashboard-sync";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { requestJson } from "@/lib/client-api";
import { getDataFreshness } from "@/lib/data-freshness";
import { getSyncRecovery } from "@/lib/sync-recovery";

// ── メインページ（統合ダッシュボード） ────────────────────

export default function DashboardPage() {
  const {
    posts,
    insightHistory,
    insightDate,
    setInsightDate,
    syncRuns,
    apiMedia,
    dashAccount,
    accountInsightsTrend,
    apiConnectionMessage,
    refreshDashboard,
    refreshApiData,
  } = useDashboardData();

  // ── UI state ──
  const [videoPeriod, setVideoPeriod] = useState<VideoRankingPeriod>("day");
  const [graphPeriod, setGraphPeriod] = useState<GraphPeriod>("30");
  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysis | null>(null);
  const [growthAnalysisLoading, setGrowthAnalysisLoading] = useState(false);
  const [growthAnalysisError, setGrowthAnalysisError] = useState("");

  const {
    syncing,
    syncButtonLabel,
    syncMsg,
    syncMessage,
    syncErrorMessage,
    handleFullSync,
  } = useDashboardSync(refreshApiData, refreshDashboard);

  // ── 統合ロジック ──────────────────────────────────────

  // API値（>0）があれば採用、なければ手入力値にフォールバックした実効投稿リスト
  const effectivePosts = useMemo(() => {
    if (!apiMedia.length) return posts;
    return posts.map(post => {
      const matched = matchPostToMedia(post, apiMedia);
      const m = mergePostMetrics(post, matched?.latest_insights);
      return { ...post, views: m.views, likes: m.likes, saves: m.saves, comments: m.comments, shares: m.shares };
    });
  }, [posts, apiMedia]);

  // ── 派生データ ────────────────────────────────────────

  const hourlyInsightData = useMemo(() => {
    if (!insightDate) return [];
    const targetPostIds = new Set(posts.map((post) => post.id));
    const snapshotsByHour = new Map<string, Map<string, InstagramInsightSnapshot>>();
    for (const snapshot of insightHistory) {
      if (!targetPostIds.has(snapshot.postId)) continue;
      const captured = toTokyoDateHour(snapshot.capturedAt);
      if (captured.date !== insightDate) continue;
      const postsInHour = snapshotsByHour.get(captured.hour) ?? new Map<string, InstagramInsightSnapshot>();
      const current = postsInHour.get(snapshot.postId);
      if (!current || new Date(snapshot.capturedAt).getTime() > new Date(current.capturedAt).getTime()) {
        postsInHour.set(snapshot.postId, snapshot);
      }
      snapshotsByHour.set(captured.hour, postsInHour);
    }
    let previousViews: number | null = null;
    return [...snapshotsByHour.entries()]
      .sort(([hourA], [hourB]) => hourA.localeCompare(hourB))
      .map(([hour, snapshots]) => {
        const views = [...snapshots.values()].reduce((sum, snapshot) => sum + snapshot.views, 0);
        const growth = previousViews === null ? 0 : Math.max(views - previousViews, 0);
        previousViews = views;
        return { hour: `${hour}:00`, views, growth, postCount: snapshots.size };
      });
  }, [posts, insightHistory, insightDate]);

  const periodGrowth = useMemo(() => ({
    week: calculateInsightGrowth(posts, insightHistory, 7),
    month: calculateInsightGrowth(posts, insightHistory, 30)
  }), [posts, insightHistory]);

  const growingVideos = useMemo(() => {
    const periodDays = videoPeriod === "day" ? 1 : videoPeriod === "week" ? 7 : 30;
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const targetPosts = effectivePosts.filter((post) => post.type === "video" || post.type === "reel");
    const snapshotsByPostId = new Map<string, InstagramInsightSnapshot[]>();
    for (const snapshot of insightHistory) {
      const current = snapshotsByPostId.get(snapshot.postId) ?? [];
      current.push(snapshot);
      snapshotsByPostId.set(snapshot.postId, current);
    }
    return targetPosts.flatMap((post) => {
      const snapshots = (snapshotsByPostId.get(post.id) ?? [])
        .filter((snapshot) => new Date(snapshot.capturedAt).getTime() >= cutoff)
        .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      if (!snapshots.length) return [];
      const first = snapshots[0];
      const latest = snapshots[snapshots.length - 1];
      const growth = snapshots.length >= 2 ? Math.max(latest.views - first.views, 0) : latest.views;
      const matched = matchPostToMedia(post, apiMedia);
      const hasApiData = !!(matched?.latest_insights?.views && matched.latest_insights.views > 0);
      return [{ post, growth, views: latest.views, reach: latest.reach, snapshotCount: snapshots.length, hasApiData }];
    }).sort((a, b) => b.growth - a.growth || b.views - a.views).slice(0, 5);
  }, [effectivePosts, insightHistory, videoPeriod, apiMedia]);

  const analyzeGrowingVideos = async () => {
    if (!growingVideos.length) return;
    if (!window.confirm("上位動画の共通点をOpenAI APIで分析します。API料金が発生します。実行しますか？")) return;
    setGrowthAnalysisLoading(true);
    setGrowthAnalysisError("");
    try {
      const data = await requestJson<{ analysis: GrowthAnalysis }>("/api/instagram/growth-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: growingVideos, period: videoPeriod, account: null })
      }, "共通点分析に失敗しました。");
      setGrowthAnalysis(data.analysis);
    } catch (error) {
      setGrowthAnalysisError(error instanceof Error ? error.message : "共通点分析に失敗しました。");
    } finally {
      setGrowthAnalysisLoading(false);
    }
  };

  // 統合後の実効値でチャート・集計を計算
  const data = useMemo(() => {
    const targetPosts = effectivePosts;
    const todayKey = toTokyoDateKey(new Date());
    const graphEndKey = graphPeriod === "1" ? shiftTokyoDateKey(todayKey, -1) : todayKey;
    const graphPosts = filterPostsByPeriod(targetPosts, graphPeriod, graphEndKey);
    const currentMonthKey = currentMonth();
    const todayPosts = targetPosts.filter((post) => post.date === todayKey);
    const yesterdayKey = shiftTokyoDateKey(todayKey, -1);
    const previousDayPosts = targetPosts.filter((post) => post.date === yesterdayKey);
    const last7 = filterPostsByPeriod(targetPosts, "7", todayKey);
    const prev7Range = getPreviousRangeKeys(todayKey, 7);
    const previous7Posts = targetPosts.filter((post) => post.date >= prev7Range.start && post.date <= prev7Range.end);
    const latestTodayPost = [...todayPosts].sort((a, b) => {
      const byUpdated = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (byUpdated !== 0) return byUpdated;
      return a.date < b.date ? 1 : -1;
    })[0];
    const dailyViewsMap = graphPosts.reduce((daily, post) => {
      daily.set(post.date, (daily.get(post.date) ?? 0) + post.views);
      return daily;
    }, new Map<string, number>());
    const graphRangeStart = shiftTokyoDateKey(graphEndKey, -(Number(graphPeriod) - 1));
    const graphRangeEnd = graphEndKey;
    const dailyViews = getDateRangeKeys(graphRangeStart, graphRangeEnd)
      .map((date) => ({
        axisLabel: `${date.slice(5).replace("-", "/")}|${weekdayJa(date)}`,
        tooltipLabel: `${date.slice(5).replace("-", "/")}(${weekdayJa(date)})`,
        date,
        views: dailyViewsMap.get(date) ?? 0
      }));
    const typeData = (["image", "video", "reel", "carousel"] as PostType[]).map((type) => {
      const items = graphPosts.filter((post) => post.type === type);
      return {
        name: postTypeLabels[type],
        averageViews: Math.round(average(items.map((post) => post.views))),
        averageEngagementRate: Number(average(items.map((post) => getMetrics(post).engagementRate)).toFixed(2))
      };
    });
    const graphApiCount = graphPosts.reduce((count, post) => {
      const matched = matchPostToMedia(post, apiMedia);
      const ins = matched?.latest_insights;
      const hasApiData = (ins?.views != null && ins.views > 0) || (ins?.reach != null && ins.reach > 0);
      return hasApiData ? count + 1 : count;
    }, 0);
    const graphManualCount = graphPosts.length - graphApiCount;
    const weekdayData = ["日", "月", "火", "水", "木", "金", "土"].map((day) => {
      const items = graphPosts.filter((post) => weekdayJa(post.date) === day);
      return { name: day, averageEngagementRate: Number(average(items.map((post) => getMetrics(post).engagementRate)).toFixed(2)) };
    });
    return {
      dailyViews, typeData, weekdayData,
      saveRank: [...graphPosts].sort((a, b) => b.saves - a.saves).slice(0, 5).map((post) => ({ name: post.date, saves: post.saves })),
      likeRank: [...graphPosts].sort((a, b) => b.likes - a.likes).slice(0, 5).map((post) => ({ name: post.date, likes: post.likes })),
      totalViews: targetPosts.reduce((sum, post) => sum + post.views, 0),
      averageEngagementRate: average(targetPosts.map((post) => getMetrics(post).engagementRate)),
      averageSaves: average(targetPosts.map((post) => post.saves)),
      bestType: [...typeData].sort((a, b) => b.averageEngagementRate - a.averageEngagementRate)[0],
      bestWeekday: [...weekdayData].sort((a, b) => b.averageEngagementRate - a.averageEngagementRate)[0],
      mostSavedPost: [...targetPosts].sort((a, b) => b.saves - a.saves)[0],
      currentMonthKey,
      count: targetPosts.length, graphCount: graphPosts.length,
      graphApiCount, graphManualCount,
      graphTotalViews: graphPosts.reduce((sum, post) => sum + post.views, 0),
      graphAverageEngagementRate: average(graphPosts.map((post) => getMetrics(post).engagementRate)),
      graphAverageSaves: average(graphPosts.map((post) => post.saves)),
      graphPeriodLabel: graphPeriod === "1" ? "前日" : graphPeriod === "7" ? "一週間" : graphPeriod === "14" ? "二週間" : graphPeriod === "30" ? "一ヶ月" : graphPeriod === "90" ? "90日" : "一年",
      graphEndKey,

      todayPosts, todayViews: todayPosts.reduce((sum, post) => sum + post.views, 0),
      todaySaves: todayPosts.reduce((sum, post) => sum + post.saves, 0),
      todayEngagementRate: average(todayPosts.map((post) => getMetrics(post).engagementRate)),
      latestTodayPost, todayKey,
      previousDayViews: previousDayPosts.reduce((sum, post) => sum + post.views, 0),
      previousDaySaves: previousDayPosts.reduce((sum, post) => sum + post.saves, 0),
      previousDayEngagementRate: average(previousDayPosts.map((post) => getMetrics(post).engagementRate)),
      last7Views: last7.reduce((sum, post) => sum + post.views, 0),
      last7Saves: last7.reduce((sum, post) => sum + post.saves, 0),
      last7EngagementRate: average(last7.map((post) => getMetrics(post).engagementRate)),
      previous7Views: previous7Posts.reduce((sum, post) => sum + post.views, 0),
      previous7Saves: previous7Posts.reduce((sum, post) => sum + post.saves, 0),
      previous7EngagementRate: average(previous7Posts.map((post) => getMetrics(post).engagementRate))
    };
  }, [effectivePosts, graphPeriod, apiMedia]);

  const accountInsightSummary = useMemo(() => {
    const todayKey = toTokyoDateKey(new Date());
    const graphEndKey = graphPeriod === "1" ? shiftTokyoDateKey(todayKey, -1) : todayKey;
    const graphRangeStart = shiftTokyoDateKey(graphEndKey, -(Number(graphPeriod) - 1));
    const filteredTrend = accountInsightsTrend.filter((row) => row.date >= graphRangeStart && row.date <= graphEndKey);
    const sourceTrend = filteredTrend;
    const latestRow = sourceTrend[sourceTrend.length - 1] ?? null;
    const sumField = (key: keyof DashboardAccountInsightTrendRow) => {
      const values = sourceTrend
        .map((row) => row[key])
        .filter((value): value is number => typeof value === "number");
      if (!values.length) return null;
      return values.reduce((sum, value) => sum + value, 0);
    };

    const impressions = sumField("impressions");
    const reach = sumField("reach");
    const profileViews = sumField("profile_views");
    const websiteClicks = sumField("website_clicks");
    const periodScopeLabel = `${data.graphPeriodLabel}分`;
    const primaryValue = impressions ?? reach;
    const primaryLabel = impressions != null ? "閲覧" : reach != null ? "リーチ" : "閲覧";
    const primaryDescription = impressions != null
      ? `${periodScopeLabel}の閲覧数です`
      : reach != null
        ? `${periodScopeLabel}のリーチ数です`
        : "アカウント全体インサイトはまだ未取得です";

    return {
      periodLabel: data.graphPeriodLabel,
      impressions,
      reach,
      profileViews,
      websiteClicks,
      followerCount: latestRow?.follower_count ?? dashAccount?.followers_count ?? null,
      latestDate: latestRow?.date ?? null,
      hasData: sourceTrend.length > 0,
      hasInsightMetrics: [impressions, reach, profileViews, websiteClicks].some((value) => value != null),
      primaryValue,
      primaryLabel,
      primaryDescription,
    };
  }, [accountInsightsTrend, dashAccount?.followers_count, data.graphPeriodLabel, graphPeriod]);

  const latestSyncRun = syncRuns[0] ?? null;
  const latestScheduledSyncRun = syncRuns.find((run) => run.triggerType === "scheduled") ?? null;
  const latestSyncError = syncRuns.find((run) => run.status !== "success") ?? null;
  const showPastSyncError = Boolean(latestSyncError && latestSyncRun && latestSyncRun.id !== latestSyncError.id);
  const pastSyncError = showPastSyncError ? latestSyncError : null;
  const syncMonitor = useMemo(() => getSyncMonitor(new Date(), latestScheduledSyncRun?.finishedAt), [latestScheduledSyncRun?.finishedAt]);
  const latestSyncFinishedAt = latestSyncRun ? new Date(latestSyncRun.finishedAt) : null;
  const latestScheduledErrorMessage = latestScheduledSyncRun?.errorSummary
    || latestScheduledSyncRun?.errors[0]?.message
    || null;
  const latestSyncErrorPlannedLabel = latestSyncError
    ? latestSyncError.triggerType === "scheduled"
      ? getScheduledPlannedLabel(latestSyncError.startedAt)
      : "手動実行"
    : null;
  const pastSyncErrorPlannedLabel = pastSyncError
    ? pastSyncError.triggerType === "scheduled"
      ? getScheduledPlannedLabel(pastSyncError.startedAt)
      : "手動実行"
    : null;
  const scheduledSlotStatuses = useMemo(() => {
    const todayKey = toTokyoDateKey(new Date());
    const nowJst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const scheduledRunsToday = syncRuns.filter((run) => {
      if (run.triggerType !== "scheduled") return false;
      return toTokyoDateTimeParts(run.startedAt).date === todayKey;
    }).sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    return SCHEDULED_SYNC_HOURS.map((hour, index) => {
      const slotAt = getScheduledSlotTime(todayKey, hour);
      const nextHour = SCHEDULED_SYNC_HOURS[index + 1];
      const nextSlotAt = typeof nextHour === "number"
        ? getScheduledSlotTime(todayKey, nextHour)
        : getScheduledSlotTime(shiftTokyoDateKey(todayKey, 1), SCHEDULED_SYNC_HOURS[0]);
      const slotLabel = `${String(hour).padStart(2, "0")}:17`;
      const matchedRun = scheduledRunsToday.find((run) => {
        const startedAt = new Date(run.startedAt).getTime();
        return startedAt >= slotAt.getTime() && startedAt < nextSlotAt.getTime();
      }) ?? null;

      if (matchedRun) {
        const executedAt = formatTimeJst(matchedRun.startedAt);
        return {
          slotLabel,
          plannedAt: slotLabel,
          executedAt,
          status: matchedRun.status === "success" ? "success" : matchedRun.status === "partial" ? "partial" : "failed",
          message: matchedRun.status === "success"
            ? `${executedAt} に成功`
            : `${executedAt} に ${matchedRun.errorSummary || matchedRun.errors[0]?.message || "同期エラー"}`
        } as const;
      }

      if (nowJst.getTime() < slotAt.getTime()) {
        return {
          slotLabel,
          plannedAt: slotLabel,
          executedAt: "未到来",
          status: "upcoming",
          message: "未到来"
        } as const;
      }

      return {
        slotLabel,
        plannedAt: slotLabel,
        executedAt: "未反映",
        status: "missing",
        message: "実行結果未反映"
      } as const;
    });
  }, [syncRuns]);
  const delayedExecutionEstimate = useMemo(() => {
    const successfulScheduledRuns = syncRuns
      .filter((run) => run.triggerType === "scheduled" && run.status === "success")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 8);

    if (!successfulScheduledRuns.length) return null;

    const delayMinutesList = successfulScheduledRuns.map((run) => {
      const plannedAt = getScheduledPlannedAtFromStartedAt(run.startedAt);
      const startedAtMs = new Date(run.startedAt).getTime();
      return Math.max(Math.round((startedAtMs - plannedAt.getTime()) / 60000), 0);
    });

    const averageDelayMinutes = Math.round(
      delayMinutesList.reduce((sum, minutes) => sum + minutes, 0) / delayMinutesList.length
    );
    const estimatedAt = new Date(syncMonitor.expectedScheduledAt.getTime() + averageDelayMinutes * 60000);
    const elapsedMinutes = Math.max(Math.round((Date.now() - syncMonitor.expectedScheduledAt.getTime()) / 60000), 0);

    return {
      averageDelayMinutes,
      averageDelayLabel: formatDelayMinutes(averageDelayMinutes),
      estimatedAtLabel: formatDateTimeJst(estimatedAt.toISOString()),
      elapsedLabel: formatDelayMinutes(elapsedMinutes),
      sampleCount: delayMinutesList.length,
      isPastEstimate: elapsedMinutes > averageDelayMinutes,
    };
  }, [syncMonitor.expectedScheduledAt, syncRuns]);
  const syncHistoryRows = useMemo<SyncHistoryRow[]>(() => {
    const now = new Date();
    const todayKey = toTokyoDateKey(now);
    const scheduledRuns = syncRuns
      .filter((run) => run.triggerType === "scheduled")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const manualRuns = syncRuns.filter((run) => run.triggerType === "manual");
    const scheduledRows: SyncHistoryRow[] = [];
    const scheduledDateKeys = getDateRangeKeys(shiftTokyoDateKey(todayKey, -3), todayKey);

    for (const dateKey of scheduledDateKeys) {
      for (let index = 0; index < SCHEDULED_SYNC_HOURS.length; index += 1) {
        const hour = SCHEDULED_SYNC_HOURS[index];
        const slotAt = getScheduledSlotTime(dateKey, hour);
        if (slotAt.getTime() > now.getTime()) continue;

        const nextHour = SCHEDULED_SYNC_HOURS[index + 1];
        const nextSlotAt = typeof nextHour === "number"
          ? getScheduledSlotTime(dateKey, nextHour)
          : getScheduledSlotTime(shiftTokyoDateKey(dateKey, 1), SCHEDULED_SYNC_HOURS[0]);
        const matchedRun = scheduledRuns.find((run) => {
          const startedAt = new Date(run.startedAt).getTime();
          return startedAt >= slotAt.getTime() && startedAt < nextSlotAt.getTime();
        }) ?? null;

        if (matchedRun) {
          scheduledRows.push({
            kind: "scheduled",
            key: matchedRun.id,
            plannedAt: `${dateKey} ${String(hour).padStart(2, "0")}:17`,
            executedAt: formatDateTimeJst(matchedRun.finishedAt),
            sortAtMs: slotAt.getTime(),
            triggerLabel: "自動",
            statusLabel: syncStatusLabel(matchedRun.status),
            fetchedPostsLabel: syncCountLabel(matchedRun.fetchedPosts, matchedRun.apiMode),
            savedPostsLabel: syncCountLabel(matchedRun.savedPosts, matchedRun.apiMode),
            savedSnapshotsLabel: syncCountLabel(matchedRun.savedSnapshots, matchedRun.apiMode),
            errorLabel: matchedRun.errorSummary || "-",
          });
        } else {
          scheduledRows.push({
            kind: "scheduled",
            key: `missing-${dateKey}-${hour}`,
            plannedAt: `${dateKey} ${String(hour).padStart(2, "0")}:17`,
            executedAt: "未反映",
            sortAtMs: slotAt.getTime(),
            triggerLabel: "自動",
            statusLabel: "未反映",
            fetchedPostsLabel: "-",
            savedPostsLabel: "-",
            savedSnapshotsLabel: "-",
            errorLabel: "実行結果未反映",
          });
        }
      }
    }

    const manualRows: SyncHistoryRow[] = manualRuns.map((run) => ({
      kind: "manual",
      key: run.id,
      plannedAt: "手動実行",
      executedAt: formatDateTimeJst(run.finishedAt),
      sortAtMs: new Date(run.finishedAt).getTime(),
      triggerLabel: "手動",
      statusLabel: syncStatusLabel(run.status),
      fetchedPostsLabel: syncCountLabel(run.fetchedPosts, run.apiMode),
      savedPostsLabel: syncCountLabel(run.savedPosts, run.apiMode),
      savedSnapshotsLabel: syncCountLabel(run.savedSnapshots, run.apiMode),
      errorLabel: run.errorSummary || "-",
    }));

    return [...scheduledRows, ...manualRows]
      .sort((a, b) => b.sortAtMs - a.sortAtMs)
      .slice(0, 5);
  }, [syncRuns]);
  const showLatestSyncFailurePanel = Boolean(latestSyncRun?.status === "failed" && latestSyncError && !syncMonitor.isDelayed);
  const showLatestSyncPartialPanel = Boolean(latestSyncRun?.status === "partial" && latestSyncError && !syncMonitor.isDelayed);
  const syncRecovery = getSyncRecovery(latestSyncError?.errorSummary || latestSyncError?.errors[0]?.message);
  const latestFreshness = getDataFreshness(latestSyncRun?.finishedAt);
  const showTodayMissingAlert = Boolean(
    latestSyncRun?.status === "partial" &&
    latestSyncFinishedAt &&
    toTokyoDateKey(latestSyncFinishedAt) === data.todayKey &&
    !syncMonitor.isDelayed &&
    data.todayPosts.length === 0
  );
  const syncStatusValue = syncMonitor.isDelayed
    ? "同期遅延"
    : latestScheduledSyncRun
      ? syncStatusLabel(latestScheduledSyncRun.status)
      : latestSyncRun?.triggerType === "manual"
        ? "手動のみ"
        : latestSyncRun ? syncStatusLabel(latestSyncRun.status) : "履歴なし";

  // ── レンダー ──────────────────────────────────────────

  return (
    <div>
      <PageHeader title="ダッシュボード" description="投稿データをグラフで確認し、成果が出やすい型を探します。" />

      {/* プロフィールヘッダー + 同期ボタン */}
      <Panel className="mb-6 border-stone-200/80 bg-white/88">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {dashAccount?.profile_picture_url && (
              <Image
                src={dashAccount.profile_picture_url}
                alt="profile"
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 shrink-0 rounded-full border border-stone-200 object-cover"
              />
            )}
            <div>
              {dashAccount ? (
                <>
                  <p className="font-bold text-ink">{dashAccount.name}</p>
                  <p className="text-sm text-stone-500">@{dashAccount.username} · フォロワー {fmt(dashAccount.followers_count)}</p>
                  {dashAccount.last_synced_at && (
                  <p className="text-xs text-stone-400">最終API同期: {new Date(dashAccount.last_synced_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-stone-500">{apiConnectionMessage}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleFullSync} disabled={syncing}
              className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-pink-600 transition">
              {syncButtonLabel}
            </button>
          </div>
        </div>
        {(syncMsg || syncMessage || syncErrorMessage) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {syncMsg && <p className="text-xs text-stone-600">{syncMsg}</p>}
            {syncMessage && <p className="text-xs text-emerald-700">{syncMessage}</p>}
            {syncErrorMessage && <ActionError message={syncErrorMessage} actionLabel="もう一度取得" onAction={() => { void handleFullSync(); }} className="w-full" />}
          </div>
        )}
      </Panel>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-stone-600">上の要約カードと下のグラフは同じ期間で切り替わります。</p>
        <GraphPeriodTabs graphPeriod={graphPeriod} setGraphPeriod={setGraphPeriod} />
      </div>

      <Panel className="mb-6 border-stone-200/80 bg-white/92">
        <SectionLead
          eyebrow="Overview"
          title="この期間の要点"
          description={`${accountInsightSummary.periodLabel}のアカウント全体の数字と、同じ期間の投稿集計をまとめて見られます。`}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HeroStat
            label="届いたアカウント数"
            value={formatOptionalMetric(accountInsightSummary.primaryValue)}
            note={`${accountInsightSummary.primaryDescription}${accountInsightSummary.latestDate ? ` / 最新取得日 ${accountInsightSummary.latestDate}` : ""}`}
            tone="moss"
          />
          <HeroStat
            label="現在のフォロワー数"
            value={fmt(accountInsightSummary.followerCount)}
            note="アカウント全体の現在値"
            tone="clay"
          />
          {accountInsightSummary.profileViews != null ? (
            <HeroStat
              label="プロフィール閲覧"
              value={fmt(accountInsightSummary.profileViews)}
              note={`${accountInsightSummary.periodLabel}のアカウント全体`}
              tone="sky"
            />
          ) : null}
          {accountInsightSummary.websiteClicks != null ? (
            <HeroStat
              label="サイトクリック"
              value={fmt(accountInsightSummary.websiteClicks)}
              note={`${accountInsightSummary.periodLabel}のアカウント全体`}
              tone="plum"
            />
          ) : null}
        </div>
        {!accountInsightSummary.hasInsightMetrics ? (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white/75 p-4 text-sm leading-6 text-red-700">
            アカウント全体の数字はまだ取得できていません。
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HeroStat
          label="対象投稿"
          value={`${data.graphCount}件`}
          note={data.graphCount > 0
            ? `${data.graphPeriodLabel} / API同期 ${data.graphApiCount}件 / 未取得 ${data.graphManualCount}件`
            : `${data.graphPeriodLabel}の投稿はありません`}
          tone="moss"
        />
        <HeroStat
          label="合計表示数"
          value={data.graphTotalViews.toLocaleString()}
          note={data.graphCount > 0 ? `${data.graphPeriodLabel}の集計` : "対象データなし"}
          tone="clay"
        />
        <HeroStat
          label="平均ER"
          value={`${data.graphAverageEngagementRate.toFixed(2)}%`}
          note={data.graphCount > 0 ? `${data.graphPeriodLabel}の平均値` : "対象データなし"}
          tone="sky"
        />
        <HeroStat
          label="平均保存数"
          value={Math.round(data.graphAverageSaves).toLocaleString()}
          note={data.graphCount > 0 ? `${data.graphPeriodLabel}の平均値` : "対象データなし"}
          tone="plum"
        />
        </div>
      </Panel>

      {!data.count ? (
        <EmptyState
          title="分析する投稿データはまだありません"
          description="Instagramからデータを取得すると、表示数・保存率・反応率の分析が始まります。"
          actionLabel={syncing ? "取得中..." : "Instagramデータを取得"}
          onAction={() => { if (!syncing) void handleFullSync(); }}
        />
      ) : null}

      {data.count ? (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            {/* 同期状況 */}
            <Panel className="border-stone-200/80 bg-white/88">
              <SectionLead eyebrow="Sync" title="同期状況" description="自動反映のタイミングと、最後の同期結果をすぐ確認できます。" />
              <div className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900">
                <p className="font-semibold">自動更新の予定時刻</p>
                <p className="mt-1">{SCHEDULED_SYNC_TIMES_LABEL}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Insight label="最終同期時刻" value={latestSyncRun ? formatDateTimeJst(latestSyncRun.finishedAt) : "未同期"} />
                <Insight label="最終自動同期" value={latestScheduledSyncRun ? formatDateTimeJst(latestScheduledSyncRun.finishedAt) : "未記録"} />
                <Insight label="次回同期予定" value={formatDateTimeJst(syncMonitor.nextScheduledAt.toISOString())} />
                <Insight label="同期状態" value={syncStatusValue} />
                <Insight label="データ鮮度" value={latestFreshness.label} />
              </div>
              {syncMonitor.isDelayed ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-amber-950">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-bold">自動同期が止まっています</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900">
                        予定時刻 {formatDateTimeJst(syncMonitor.expectedScheduledAt.toISOString())} の定期取得がまだ反映されていません。
                      </p>
                      {delayedExecutionEstimate ? (
                        <p className="mt-2 text-sm leading-6 text-amber-900">
                          最近の傾向では、<span className="font-semibold">{delayedExecutionEstimate.estimatedAtLabel} ごろ</span>に動く見込みです。
                        </p>
                      ) : null}
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      要確認
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <SyncInfoRow
                      label="最後に反映された自動同期"
                      value={latestScheduledSyncRun ? formatDateTimeJst(latestScheduledSyncRun.finishedAt) : "未記録"}
                    />
                    <SyncInfoRow
                      label="次の予定時刻"
                      value={formatDateTimeJst(syncMonitor.nextScheduledAt.toISOString())}
                    />
                    {delayedExecutionEstimate ? (
                      <SyncInfoRow
                        label="今回の予測時刻"
                        value={`${delayedExecutionEstimate.estimatedAtLabel} ごろ`}
                      />
                    ) : null}
                    {delayedExecutionEstimate ? (
                      <SyncInfoRow
                        label="最近の平均遅れ"
                        value={`${delayedExecutionEstimate.averageDelayLabel}（直近${delayedExecutionEstimate.sampleCount}回）`}
                      />
                    ) : null}
                    {delayedExecutionEstimate ? (
                      <SyncInfoRow
                        label="いまの遅れ"
                        value={delayedExecutionEstimate.isPastEstimate
                          ? `${delayedExecutionEstimate.elapsedLabel}経過 / 目安を超過`
                          : `${delayedExecutionEstimate.elapsedLabel}経過`}
                      />
                    ) : null}
                    {latestScheduledErrorMessage ? (
                      <SyncInfoRow label="直近のエラー内容" value={latestScheduledErrorMessage} />
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-xl border border-amber-200/80 bg-white/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">本日の自動同期予定</p>
                    <div className="mt-3 grid gap-2">
                      {scheduledSlotStatuses.map((slot) => (
                        <div key={slot.slotLabel} className="grid gap-2 rounded-lg border border-stone-200/80 bg-white/80 px-3 py-2 md:grid-cols-[84px_110px_110px_96px_1fr] md:items-center">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">予定</p>
                            <p className="text-sm font-semibold text-ink">{slot.plannedAt}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">実行</p>
                            <p className="text-sm font-semibold text-ink">{slot.executedAt}</p>
                          </div>
                          <p className={`text-sm font-semibold ${
                            slot.status === "success"
                              ? "text-emerald-700"
                              : slot.status === "partial"
                                ? "text-amber-700"
                                : slot.status === "failed" || slot.status === "missing"
                                  ? "text-red-700"
                                  : "text-stone-500"
                          }`}>
                            {slot.status === "success"
                              ? "成功"
                              : slot.status === "partial"
                                ? "一部失敗"
                                : slot.status === "failed"
                                  ? "失敗"
                                  : slot.status === "missing"
                                    ? "未反映"
                                    : "未到来"}
                          </p>
                          <p className="text-sm text-stone-700">{slot.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {latestSyncRun ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-stone-200/80 bg-fog/70 p-4 md:grid-cols-4">
                  <MiniMetric label="取得投稿" value={`${latestSyncRun.fetchedPosts}件`} />
                  <MiniMetric label="投稿保存" value={`${latestSyncRun.savedPosts}件`} />
                  <MiniMetric label="履歴保存" value={`${latestSyncRun.savedSnapshots}件`} />
                  <MiniMetric label="失敗" value={`${latestSyncRun.failedPosts}件`} />
                </div>
              ) : null}
              {showLatestSyncFailurePanel && latestSyncError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                  <p className="font-semibold">自動同期に失敗しました</p>
                  <p className="mt-1">{latestSyncError.errorSummary || latestSyncError.errors[0]?.message || "同期でエラーが発生しました。"}</p>
                  <p className="mt-2 font-medium">原因: {syncRecovery.cause}</p>
                  <p>次の操作: {syncRecovery.nextAction}</p>
                  <a href={syncRecovery.href} className="mt-3 inline-flex rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white">{syncRecovery.actionLabel}</a>
                  {latestSyncErrorPlannedLabel ? (
                    <p className="mt-2 text-xs text-red-700">予定時刻: {latestSyncErrorPlannedLabel}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-red-700">発生時刻: {formatDateTimeJst(latestSyncError.finishedAt)}</p>
                </div>
              ) : null}
              {showLatestSyncPartialPanel && latestSyncError ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">自動同期で一部失敗しました</p>
                  <p className="mt-1">{latestSyncError.errorSummary || latestSyncError.errors[0]?.message || "一部のデータ保存に失敗しました。"}</p>
                  <p className="mt-2 font-medium">原因: {syncRecovery.cause}</p>
                  <p>次の操作: {syncRecovery.nextAction}</p>
                  <a href={syncRecovery.href} className="mt-3 inline-flex rounded-md bg-amber-800 px-3 py-2 text-xs font-semibold text-white">{syncRecovery.actionLabel}</a>
                  {latestSyncErrorPlannedLabel ? (
                    <p className="mt-2 text-xs text-amber-700">予定時刻: {latestSyncErrorPlannedLabel}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-amber-700">発生時刻: {formatDateTimeJst(latestSyncError.finishedAt)}</p>
                </div>
              ) : null}
              {pastSyncError ? (
                <div className="mt-4 rounded-xl border border-stone-200 bg-white/75 p-4 text-sm leading-6 text-stone-700">
                  <p className="font-semibold text-ink">前回の失敗履歴</p>
                  <p className="mt-1">{pastSyncError.errorSummary || "前回の同期でエラーが発生しました。"}</p>
                  {pastSyncErrorPlannedLabel ? (
                    <p className="mt-2 text-xs text-stone-500">予定時刻: {pastSyncErrorPlannedLabel}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-stone-500">発生時刻: {formatDateTimeJst(pastSyncError.finishedAt)}</p>
                </div>
              ) : null}
            </Panel>

            {/* 今日の投稿 */}
            <Panel className="border-stone-200/80 bg-gradient-to-br from-white/92 to-oat/70">
              <SectionLead eyebrow="Today" title="今日の投稿" description="日次確認に必要な投稿数、表示数、直近投稿をまとめています。" />
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                <Insight label="今日の投稿件数" value={`${data.todayPosts.length}件`} />
                <Insight label="今日の表示数合計" value={data.todayViews.toLocaleString()} />
              </div>
              {showTodayMissingAlert ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">今日の投稿が未取得の可能性があります</p>
                  <p className="mt-1">直近2時間以内の同期は成功していますが、{data.todayKey} の投稿が0件です。</p>
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-stone-200/80 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">直近投稿</p>
                {data.latestTodayPost ? (
                  <>
                    <p className="mt-2 line-clamp-2 font-semibold text-ink">{videoTitle(data.latestTodayPost)}</p>
                    <p className="mt-2 text-sm text-stone-600">表示数 {data.latestTodayPost.views.toLocaleString()} / 保存 {data.latestTodayPost.saves.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-stone-500">投稿日 {data.latestTodayPost.date}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-stone-600">{data.todayKey} の投稿はまだありません。</p>
                )}
              </div>
            </Panel>
          </div>

          <details className="rounded-lg border border-stone-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-700">
              詳しい分析を開く
            </summary>
            <div className="border-t border-stone-200 px-4 py-5">
          {/* 同期履歴 */}
          <Panel className="mb-6">
            <SectionLead eyebrow="History" title="同期履歴一覧" description="直近5回の実行結果を確認できます。" />
            <div className="mt-4 overflow-auto">
              <table>
                <caption className="sr-only">直近5回の同期予定と実行結果</caption>
                <thead>
                  <tr><th>予定時刻</th><th>実施時刻</th><th>種別</th><th>状態</th><th>取得</th><th>投稿保存</th><th>履歴保存</th><th>エラー内容</th></tr>
                </thead>
                <tbody>
                  {syncHistoryRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.plannedAt}</td>
                      <td>{row.executedAt}</td>
                      <td>{row.triggerLabel}</td>
                      <td>{row.statusLabel}</td>
                      <td>{row.fetchedPostsLabel}</td>
                      <td>{row.savedPostsLabel}</td>
                      <td>{row.savedSnapshotsLabel}</td>
                      <td>{row.errorLabel}</td>
                    </tr>
                  ))}
                  {!syncHistoryRows.length ? (
                    <tr><td colSpan={8} className="text-center text-stone-500">同期履歴はまだありません。</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* 前回比 */}
          <Panel className="mb-6">
            <SectionLead eyebrow="Compare" title="前回比" description="表示数、保存数、ER の前日比と前週比をひと目で比較できます。" />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <CompareStat label="表示数" currentDay={data.todayViews} previousDay={data.previousDayViews} currentWeek={data.last7Views} previousWeek={data.previous7Views} />
              <CompareStat label="保存数" currentDay={data.todaySaves} previousDay={data.previousDaySaves} currentWeek={data.last7Saves} previousWeek={data.previous7Saves} />
              <CompareStat label="平均ER" currentDay={data.todayEngagementRate} previousDay={data.previousDayEngagementRate} currentWeek={data.last7EngagementRate} previousWeek={data.previous7EngagementRate} suffix="%" decimal />
            </div>
          </Panel>

          <VideoRankingSection
            period={videoPeriod}
            onPeriodChange={(period) => {
              setVideoPeriod(period);
              setGrowthAnalysis(null);
              setGrowthAnalysisError("");
            }}
            videos={growingVideos}
            analysis={growthAnalysis}
            analysisLoading={growthAnalysisLoading}
            analysisError={growthAnalysisError}
            onAnalyze={() => { void analyzeGrowingVideos(); }}
          />

          {/* 読み取りポイント */}
          <Panel className="mb-6">
            <SectionLead eyebrow="Highlights" title="読み取りポイント" description="相対的に強い曜日・投稿タイプをひと目で拾えるように整理しています。" />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Insight label="反応が良い投稿タイプ" value={data.bestType?.averageEngagementRate ? `${data.bestType.name} / ${data.bestType.averageEngagementRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="反応が良い曜日" value={data.bestWeekday?.averageEngagementRate ? `${data.bestWeekday.name}曜日 / ${data.bestWeekday.averageEngagementRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="保存されやすい投稿" value={data.mostSavedPost ? `${data.mostSavedPost.date} / ${data.mostSavedPost.saves.toLocaleString()}保存` : "データ不足"} />
            </div>
          </Panel>

            </div>
          </details>
        </>
      ) : null}

      <DashboardCharts data={data} />
      <HourlyInsightPanel insightDate={insightDate} onInsightDateChange={setInsightDate} rows={hourlyInsightData} />
      <PeriodGrowthSection week={periodGrowth.week} month={periodGrowth.month} />
    </div>
  );
}
