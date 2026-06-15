"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadAccountsData, loadAnalysesData, loadPostsData, loadTasksData } from "@/lib/cloud-storage";
import { ImprovementTask, InstagramAccount, InstagramPost, PostType } from "@/lib/types";
import { average, byDateAsc, getMetrics, postCategoryOptions, postTypeLabels, taskStatusLabels, weekdayJa } from "@/lib/metrics";

export default function DashboardPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [tasks, setTasks] = useState<ImprovementTask[]>([]);
  const [latestScoreByPostId, setLatestScoreByPostId] = useState<Record<string, number>>({});
  const [accountId, setAccountId] = useState("all");
  useEffect(() => {
    Promise.all([loadPostsData(), loadAccountsData(), loadTasksData()]).then(([loadedPosts, loadedAccounts, loadedTasks]) => {
      setPosts(loadedPosts);
      setAccounts(loadedAccounts);
      setTasks(loadedTasks);
      Promise.all(loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]?.score] as const)).then((scores) => {
        setLatestScoreByPostId(Object.fromEntries(scores.filter(([, score]) => typeof score === "number")));
      });
    });
  }, []);

  const data = useMemo(() => {
    const targetPosts = posts.filter((post) => accountId === "all" || post.accountId === accountId);
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
      taskCount: targetTasks.length,
      openTaskCount: openTasks.length,
      overdueTaskCount: overdueTasks.length,
      completionRate,
      nextTask,
      nextTaskPost: nextTask?.postId ? postById[nextTask.postId] : undefined,
      count: targetPosts.length
    };
  }, [posts, tasks, accountId, latestScoreByPostId]);

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

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200/80 bg-fog/80 p-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-base font-bold text-ink">{value}</p>
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
