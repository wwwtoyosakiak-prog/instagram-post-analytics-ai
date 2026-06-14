"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { loadAccounts, loadPosts } from "@/lib/storage";
import { InstagramAccount, InstagramPost, MonthlyReport } from "@/lib/types";
import { average, formatPercent, getMetrics } from "@/lib/metrics";

export default function ReportsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [accountId, setAccountId] = useState("all");
  const [month, setMonth] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loaded = loadPosts();
    setPosts(loaded);
    setAccounts(loadAccounts());
    setMonth(loaded[0]?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7));
  }, []);

  const report = useMemo<MonthlyReport>(() => {
    const monthly = posts.filter((post) => post.date.startsWith(month)).filter((post) => accountId === "all" || post.accountId === accountId);
    const ranked = [...monthly].sort((a, b) => getMetrics(b).engagementRate - getMetrics(a).engagementRate);
    return {
      month,
      totalViews: monthly.reduce((sum, post) => sum + post.views, 0),
      averageLikes: average(monthly.map((post) => post.likes)),
      averageSaves: average(monthly.map((post) => post.saves)),
      averageEngagementRate: average(monthly.map((post) => getMetrics(post).engagementRate)),
      topPosts: ranked.slice(0, 3),
      needsWorkPosts: ranked.slice(-3).reverse(),
      summary: aiSummary || "AI総評は「AI総評を作成」またはサンプル総評で表示します。",
      nextMonthPolicy: ["保存されるノウハウ投稿を増やす", "リール冒頭で結論を見せる", "コメントを促す質問を入れる"]
    };
  }, [posts, month, accountId, aiSummary]);

  const createAiReport = async () => {
    const account = accounts.find((item) => item.id === accountId) ?? null;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, account, posts: posts.filter((post) => post.date.startsWith(month)).filter((post) => accountId === "all" || post.accountId === accountId) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI総評の作成に失敗しました。");
      setAiSummary(data.summary);
    } catch (event) {
      setError(event instanceof Error ? event.message : "AI総評の作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="月次レポート" description="登録済み投稿を月別に集計し、伸びた投稿と改善が必要な投稿を確認します。" />
      <Panel className="mb-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label>対象月</label>
            <input className="mt-1" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <label>アカウント</label>
            <select className="mt-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="all">すべて</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="合計表示数" value={report.totalViews.toLocaleString()} />
        <Stat label="平均いいね数" value={Math.round(report.averageLikes).toLocaleString()} />
        <Stat label="平均保存数" value={Math.round(report.averageSaves).toLocaleString()} />
        <Stat label="平均エンゲージメント率" value={formatPercent(report.averageEngagementRate)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Ranking title="伸びた投稿TOP3" posts={report.topPosts} />
        <Ranking title="改善が必要な投稿TOP3" posts={report.needsWorkPosts} />
      </div>
      <Panel className="mt-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={createAiReport} disabled={loading}>{loading ? "作成中..." : "AI総評を作成"}</Button>
          <Button variant="secondary" onClick={() => setAiSummary("リールは表示数獲得に強く、カルーセルは保存に貢献しています。来月は実演リールで認知を広げ、保存されるチェックリスト投稿で見込み顧客との接点を増やす方針が有効です。")}>サンプル総評</Button>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <h2 className="font-semibold">AIによる総評</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">{report.summary}</p>
        <h2 className="mt-5 font-semibold">来月の投稿方針</h2>
        <ul className="mt-2 grid gap-2">
          {report.nextMonthPolicy.map((item) => <li className="rounded-md bg-stone-100 px-3 py-2 text-sm" key={item}>{item}</li>)}
        </ul>
      </Panel>
    </div>
  );
}

function Ranking({ title, posts }: { title: string; posts: InstagramPost[] }) {
  return (
    <Panel>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-3">
        {posts.map((post) => (
          <Link href={`/posts/${post.id}`} key={post.id} className="block rounded-md border border-stone-200 p-3 hover:border-moss">
            <p className="text-sm font-semibold">{post.date} / ER {formatPercent(getMetrics(post).engagementRate)}</p>
            <p className="mt-1 line-clamp-2 text-sm text-stone-600">{post.caption}</p>
          </Link>
        ))}
        {!posts.length ? <p className="text-sm text-stone-500">対象月の投稿がありません。</p> : null}
      </div>
    </Panel>
  );
}
