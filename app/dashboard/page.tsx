"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Panel } from "@/components/ui";
import { loadAccounts, loadPosts } from "@/lib/storage";
import { InstagramAccount, InstagramPost, PostType } from "@/lib/types";
import { average, byDateAsc, getMetrics, postTypeLabels, weekdayJa } from "@/lib/metrics";

export default function DashboardPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [accountId, setAccountId] = useState("all");
  useEffect(() => {
    setPosts(loadPosts());
    setAccounts(loadAccounts());
  }, []);

  const data = useMemo(() => {
    const targetPosts = posts.filter((post) => accountId === "all" || post.accountId === accountId);
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
    return {
      dailyViews: sorted.map((post) => ({ name: post.date.slice(5), views: post.views })),
      typeData,
      weekdayData,
      saveRank: [...targetPosts].sort((a, b) => b.saves - a.saves).slice(0, 5).map((post) => ({ name: post.date, saves: post.saves })),
      likeRank: [...targetPosts].sort((a, b) => b.likes - a.likes).slice(0, 5).map((post) => ({ name: post.date, likes: post.likes })),
      count: targetPosts.length
    };
  }, [posts, accountId]);

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
