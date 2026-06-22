"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { loadAccountsData, loadAllInsightData, loadAnalysesData, loadGoalsData, loadPostsData, loadTasksData } from "@/lib/cloud-storage";
import { ImprovementTask, InstagramAccount, InstagramInsightSnapshot, InstagramPost, MonthlyGoal, PostType } from "@/lib/types";
import { average, byDateAsc, getMetrics, postCategoryOptions, postTypeLabels, taskStatusLabels, weekdayJa } from "@/lib/metrics";

type GrowthAnalysis = {
  summary: string;
  openingPatterns: string[];
  themes: string[];
  formatPatterns: string[];
  hashtagPatterns: string[];
  nextActions: string[];
};

export default function DashboardPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [tasks, setTasks] = useState<ImprovementTask[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [insightHistory, setInsightHistory] = useState<InstagramInsightSnapshot[]>([]);
  const [latestScoreByPostId, setLatestScoreByPostId] = useState<Record<string, number>>({});
  const [accountId, setAccountId] = useState("all");
  const [videoPeriod, setVideoPeriod] = useState<"day" | "week" | "month">("day");
  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysis | null>(null);
  const [growthAnalysisLoading, setGrowthAnalysisLoading] = useState(false);
  const [growthAnalysisError, setGrowthAnalysisError] = useState("");
  useEffect(() => {
    Promise.all([loadPostsData(), loadAccountsData(), loadTasksData(), loadGoalsData(), loadAllInsightData()]).then(([loadedPosts, loadedAccounts, loadedTasks, loadedGoals, loadedInsights]) => {
      setPosts(loadedPosts);
      setAccounts(loadedAccounts);
      setTasks(loadedTasks);
      setGoals(loadedGoals);
      setInsightHistory(loadedInsights);
      Promise.all(loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]?.score] as const)).then((scores) => {
        setLatestScoreByPostId(Object.fromEntries(scores.filter(([, score]) => typeof score === "number")));
      });
    });
  }, []);

  const growingVideos = useMemo(() => {
    const periodDays = videoPeriod === "day" ? 1 : videoPeriod === "week" ? 7 : 30;
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const targetPosts = posts.filter((post) =>
      (post.type === "video" || post.type === "reel") &&
      (accountId === "all" || post.accountId === accountId)
    );
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
      return [{ post, growth, views: latest.views, reach: latest.reach, snapshotCount: snapshots.length }];
    }).sort((a, b) => b.growth - a.growth || b.views - a.views).slice(0, 5);
  }, [posts, insightHistory, accountId, videoPeriod]);

  const analyzeGrowingVideos = async () => {
    if (!growingVideos.length) return;
    if (!window.confirm("上位動画の共通点をOpenAI APIで分析します。API料金が発生します。実行しますか？")) return;
    setGrowthAnalysisLoading(true);
    setGrowthAnalysisError("");
    try {
      const account = accounts.find((item) => item.id === accountId) ?? null;
      const response = await fetch("/api/instagram/growth-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: growingVideos, period: videoPeriod, account })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "共通点分析に失敗しました。");
      setGrowthAnalysis(data.analysis);
    } catch (error) {
      setGrowthAnalysisError(error instanceof Error ? error.message : "共通点分析に失敗しました。");
    } finally {
      setGrowthAnalysisLoading(false);
    }
  };

  const data = useMemo(() => {
    const targetPosts = posts.filter((post) => accountId === "all" || post.accountId === accountId);
    const currentMonthKey = currentMonth();
    const monthlyPosts = targetPosts.filter((post) => post.date.startsWith(currentMonthKey));
    const monthlyActual = {
      posts: monthlyPosts.length,
      views: monthlyPosts.reduce((sum, post) => sum + post.views, 0),
      saves: monthlyPosts.reduce((sum, post) => sum + post.saves, 0),
      saveRate: average(monthlyPosts.map((post) => getMetrics(post).saveRate)),
      engagementRate: average(monthlyPosts.map((post) => getMetrics(post).engagementRate))
    };
    const selectedGoal = goals.find((goal) => goal.month === currentMonthKey && (goal.accountId ?? null) === (accountId === "all" ? null : accountId)) ?? null;
    const targetPostIds = new Set(targetPosts.map((post) => post.id));
    const postById = Object.fromEntries(posts.map((post) => [post.id, post]));
    const targetTasks = tasks.filter((task) => !task.postId || accountId === "all" || targetPostIds.has(task.postId));
    const today = toDateKey(new Date());
    const openTasks = targetTasks.filter((task) => task.status !== "done");
    const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
    const completedTasks = targetTasks.filter((task) => task.status === "done");
    const completionRate = targetTasks.length ? (completedTasks.length / targetTasks.length) * 100 : 0;
    const sorted = [...targetPosts].sort(byDateAsc);
    const typeData = (["image", "video", "reel", "carousel"] as PostType[]).map((type) => {
      const items = targetPosts.filter((post) => post.type === type);
      return {
        name: postTypeLabels[type],
        averageViews: Math.round(average(items.map((post) => post.views))),
        averageEngagementRate: Number(average(items.map((post) => getMetrics(post).engagementRate)).toFixed(2))
      };
    });
    const weekdayData = ["日", "月", "火", "水", "木", "金", "土"].map((day) => {
      const items = targetPosts.filter((post) => weekdayJa(post.date) === day);
      return { name: day, averageEngagementRate: Number(average(items.map((post) => getMetrics(post).engagementRate)).toFixed(2)) };
    });
    const categoryData = postCategoryOptions.map((category) => {
      const items = targetPosts.filter((post) => (post.category ?? "other") === category.value);
      const scores = items.map((post) => latestScoreByPostId[post.id]).filter((score): score is number => typeof score === "number");
      const categoryPostIds = new Set(items.map((post) => post.id));
      const categoryTasks = targetTasks.filter((task) => task.postId && categoryPostIds.has(task.postId));
      return {
        name: category.label,
        averageViews: Math.round(average(items.map((post) => post.views))),
        averageSaveRate: Number(average(items.map((post) => getMetrics(post).saveRate)).toFixed(2)),
        averageAiScore: Number(average(scores).toFixed(1)),
        taskCount: categoryTasks.length,
        openTaskCount: categoryTasks.filter((task) => task.status !== "done").length,
        count: items.length
      };
    });
    const taskStatusData = (["todo", "doing", "done"] as const).map((status) => ({
      name: taskStatusLabels[status],
      count: targetTasks.filter((task) => task.status === status).length
    }));
    const taskCategoryData = categoryData.filter((item) => item.taskCount > 0);
    const nextTask = [...openTasks].filter((task) => task.dueDate).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
    return {
      dailyViews: sorted.map((post) => ({ name: post.date.slice(5), views: post.views })),
      typeData,
      weekdayData,
      categoryData,
      taskStatusData,
      taskCategoryData,
      saveRank: [...targetPosts].sort((a, b) => b.saves - a.saves).slice(0, 5).map((post) => ({ name: post.date, saves: post.saves })),
      likeRank: [...targetPosts].sort((a, b) => b.likes - a.likes).slice(0, 5).map((post) => ({ name: post.date, likes: post.likes })),
      totalViews: targetPosts.reduce((sum, post) => sum + post.views, 0),
      averageEngagementRate: average(targetPosts.map((post) => getMetrics(post).engagementRate)),
      averageSaves: average(targetPosts.map((post) => post.saves)),
      bestType: [...typeData].sort((a, b) => b.averageEngagementRate - a.averageEngagementRate)[0],
      bestWeekday: [...weekdayData].sort((a, b) => b.averageEngagementRate - a.averageEngagementRate)[0],
      bestCategory: [...categoryData].filter((item) => item.count > 0).sort((a, b) => b.averageSaveRate - a.averageSaveRate)[0],
      bestAiScoreCategory: [...categoryData].filter((item) => item.averageAiScore > 0).sort((a, b) => b.averageAiScore - a.averageAiScore)[0],
      mostSavedPost: [...targetPosts].sort((a, b) => b.saves - a.saves)[0],
      currentMonthKey,
      monthlyActual,
      selectedGoal,
      taskCount: targetTasks.length,
      openTaskCount: openTasks.length,
      overdueTaskCount: overdueTasks.length,
      completionRate,
      nextTask,
      nextTaskPost: nextTask?.postId ? postById[nextTask.postId] : undefined,
      count: targetPosts.length
    };
  }, [posts, tasks, goals, accountId, latestScoreByPostId]);

  return (
    <div>
      <PageHeader title="ダッシュボード" description="投稿データをグラフで確認し、成果が出やすい型を探します。" />
      <Panel className="mb-6">
        <label>アカウント</label>
        <select className="mt-1 max-w-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="all">すべて</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
      </Panel>
      {!data.count ? <Panel><p className="text-sm text-stone-600">対象の投稿データがありません。登録ページからサンプルデータを追加できます。</p></Panel> : null}
      {data.count ? (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Stat label="対象投稿" value={`${data.count}件`} />
            <Stat label="合計表示数" value={data.totalViews.toLocaleString()} />
            <Stat label="平均ER" value={`${data.averageEngagementRate.toFixed(2)}%`} />
            <Stat label="平均保存数" value={Math.round(data.averageSaves).toLocaleString()} />
          </div>
          <section className="mb-6 border-y border-stone-200 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">伸びている動画ランキング</h2>
                <p className="mt-1 text-sm text-stone-600">同期履歴から期間内の閲覧数増加を比較します。</p>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-stone-200 bg-white/80 p-1" aria-label="動画ランキング期間">
                {(["day", "week", "month"] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      setVideoPeriod(period);
                      setGrowthAnalysis(null);
                      setGrowthAnalysisError("");
                    }}
                    className={`h-9 min-w-16 rounded px-3 text-sm font-semibold transition ${videoPeriod === period ? "bg-ink text-white" : "text-stone-600 hover:bg-fog"}`}
                  >
                    {period === "day" ? "日" : period === "week" ? "週" : "月"}
                  </button>
                ))}
              </div>
            </div>
            {growingVideos.length ? (
              <div className="mt-5 grid gap-2">
                {growingVideos.map((item, index) => (
                  <Link
                    key={item.post.id}
                    href={`/posts/detail?id=${item.post.id}`}
                    className="grid gap-3 border-b border-stone-200 px-2 py-4 transition hover:bg-white/60 md:grid-cols-[52px_64px_1fr_auto] md:items-center"
                  >
                    <span className="text-2xl font-bold text-clay">{index + 1}</span>
                    {getPostPreview(item.post) ? (
                      <img src={getPostPreview(item.post)} alt="投稿サムネイル" className="h-16 w-16 rounded-md object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-md bg-fog text-[10px] text-stone-500">画像なし</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{videoTitle(item.post)}</span>
                      <span className="mt-1 block text-xs text-stone-500">投稿日 {item.post.date} / リーチ {item.reach.toLocaleString()}</span>
                    </span>
                    <span className="text-left md:text-right">
                      <span className="block text-lg font-bold text-ink">+{item.growth.toLocaleString()} 閲覧</span>
                      <span className="mt-1 block text-xs text-stone-500">現在 {item.views.toLocaleString()} / 履歴 {item.snapshotCount}回</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">この期間に同期された動画データがありません。</p>
            )}
            <p className="mt-3 text-xs leading-5 text-stone-500">期間内の履歴が1回だけの場合は、現在の閲覧数を増加値として表示します。継続同期すると実際の差分になります。</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={analyzeGrowingVideos} disabled={!growingVideos.length || growthAnalysisLoading}>
                {growthAnalysisLoading ? "共通点を分析中..." : "上位動画の共通点をAI分析"}
              </Button>
              {growthAnalysisError ? <p className="text-sm text-red-700">{growthAnalysisError}</p> : null}
            </div>
            {growthAnalysis ? (
              <div className="mt-6 border-t border-stone-200 pt-5">
                <h3 className="font-semibold text-ink">AIによる共通点分析</h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">{growthAnalysis.summary}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <GrowthPattern title="冒頭文・フック" items={growthAnalysis.openingPatterns} />
                  <GrowthPattern title="テーマ" items={growthAnalysis.themes} />
                  <GrowthPattern title="動画形式・構成" items={growthAnalysis.formatPatterns} />
                  <GrowthPattern title="ハッシュタグ" items={growthAnalysis.hashtagPatterns} />
                  <GrowthPattern title="次回アクション" items={growthAnalysis.nextActions} />
                </div>
              </div>
            ) : null}
          </section>
          <Panel className="mb-6">
            <h2 className="font-semibold">読み取りポイント</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <Insight label="反応が良い投稿タイプ" value={data.bestType?.averageEngagementRate ? `${data.bestType.name} / ${data.bestType.averageEngagementRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="反応が良い曜日" value={data.bestWeekday?.averageEngagementRate ? `${data.bestWeekday.name}曜日 / ${data.bestWeekday.averageEngagementRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="保存されやすいカテゴリ" value={data.bestCategory ? `${data.bestCategory.name} / ${data.bestCategory.averageSaveRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="AI評価が高いカテゴリ" value={data.bestAiScoreCategory ? `${data.bestAiScoreCategory.name} / ${data.bestAiScoreCategory.averageAiScore.toFixed(1)}点` : "分析履歴なし"} />
              <Insight label="保存されやすい投稿" value={data.mostSavedPost ? `${data.mostSavedPost.date} / ${data.mostSavedPost.saves.toLocaleString()}保存` : "データ不足"} />
            </div>
          </Panel>
          <Panel className="mb-6">
            <h2 className="font-semibold">改善タスク進捗</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Insight label="未完了タスク" value={`${data.openTaskCount}件`} />
              <Insight label="完了率" value={`${data.completionRate.toFixed(1)}%`} />
              <Insight label="期限切れ" value={`${data.overdueTaskCount}件`} />
              <Insight label="次の期限" value={data.nextTask ? `${data.nextTask.dueDate} / ${data.nextTaskPost?.date ?? "投稿未紐づけ"}` : "期限付きタスクなし"} />
            </div>
          </Panel>
          <Panel className="mb-6">
            <h2 className="font-semibold">今月の目標達成率</h2>
            {data.selectedGoal ? (
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <Progress label="投稿数" actual={data.monthlyActual.posts} target={data.selectedGoal.targetPosts} suffix="件" />
                <Progress label="表示数" actual={data.monthlyActual.views} target={data.selectedGoal.targetViews} suffix="" />
                <Progress label="保存数" actual={data.monthlyActual.saves} target={data.selectedGoal.targetSaves} suffix="" />
                <Progress label="平均保存率" actual={data.monthlyActual.saveRate} target={data.selectedGoal.targetSaveRate} suffix="%" decimal />
                <Progress label="平均ER" actual={data.monthlyActual.engagementRate} target={data.selectedGoal.targetEngagementRate} suffix="%" decimal />
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-600">{data.currentMonthKey} の目標は未設定です。目標管理ページで設定できます。</p>
            )}
          </Panel>
        </>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="日別表示数の推移">
          <LineChart data={data.dailyViews}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="views" name="表示数" stroke="#b55d3e" strokeWidth={2} />
          </LineChart>
        </ChartPanel>
        <ChartPanel title="投稿タイプ別の平均表示数">
          <BarChart data={data.typeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="averageViews" name="平均表示数" fill="#53624a" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の平均表示数">
          <BarChart data={data.categoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="averageViews" name="平均表示数" fill="#4f6b57" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の平均保存率">
          <BarChart data={data.categoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="averageSaveRate" name="平均保存率" fill="#2f766d" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の平均AIスコア">
          <BarChart data={data.categoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="averageAiScore" name="平均AIスコア" fill="#5a4356" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="改善タスクの状態別件数">
          <BarChart data={data.taskStatusData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="タスク数" fill="#b55d3e" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の改善タスク数">
          <BarChart data={data.taskCategoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="taskCount" name="全タスク" fill="#53624a" />
            <Bar dataKey="openTaskCount" name="未完了" fill="#b55d3e" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="投稿タイプ別の平均エンゲージメント率">
          <BarChart data={data.typeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="averageEngagementRate" name="平均エンゲージメント率" fill="#b55d3e" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="曜日別の平均エンゲージメント率">
          <BarChart data={data.weekdayData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="averageEngagementRate" name="平均エンゲージメント率" fill="#2f766d" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="保存数ランキング">
          <BarChart data={data.saveRank}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="saves" name="保存数" fill="#53624a" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="いいね数ランキング">
          <BarChart data={data.likeRank}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="likes" name="いいね数" fill="#b55d3e" />
          </BarChart>
        </ChartPanel>
      </div>
    </div>
  );
}

function videoTitle(post: InstagramPost) {
  const firstLine = post.caption.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine || `${post.date}の動画投稿`;
}

function getPostPreview(post: InstagramPost) {
  return post.screenshot || post.thumbnailUrl || post.mediaUrl || "";
}

function GrowthPattern({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-l-2 border-clay pl-4">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200/80 bg-fog/80 p-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-base font-bold text-ink">{value}</p>
    </div>
  );
}

function Progress({ label, actual, target, suffix, decimal = false }: { label: string; actual: number; target: number; suffix: string; decimal?: boolean }) {
  const rate = target > 0 ? Math.min((actual / target) * 100, 999) : 0;
  const actualText = decimal ? actual.toFixed(2) : Math.round(actual).toLocaleString();
  const targetText = decimal ? target.toFixed(2) : Math.round(target).toLocaleString();
  return (
    <div className="rounded-md border border-stone-200/80 bg-fog/80 p-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{target > 0 ? `${rate.toFixed(0)}%` : "未設定"}</p>
      <p className="mt-1 text-xs text-stone-600">実績 {actualText}{suffix} / 目標 {targetText}{suffix}</p>
      <div className="mt-3 h-2 rounded-full bg-white">
        <div className="h-2 rounded-full bg-moss" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Panel>
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
