"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { loadAccountsData, loadAnalysesData, loadMonthlyReportsData, loadPostsData, saveMonthlyReportData } from "@/lib/cloud-storage";
import { AiAnalysisRecord, CategoryAiReport, InstagramAccount, InstagramPost, MonthlyReport, MonthlyReportRecord } from "@/lib/types";
import { average, formatPercent, getMetrics, postCategoryOptions } from "@/lib/metrics";

export default function ReportsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [latestAnalysisByPostId, setLatestAnalysisByPostId] = useState<Record<string, AiAnalysisRecord>>({});
  const [accountId, setAccountId] = useState("all");
  const [month, setMonth] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [categoryAiReport, setCategoryAiReport] = useState<CategoryAiReport | null>(null);
  const [savedReports, setSavedReports] = useState<MonthlyReportRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<MonthlyReportRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([loadPostsData(), loadAccountsData()]).then(([loadedPosts, loadedAccounts]) => {
      setPosts(loadedPosts);
      setAccounts(loadedAccounts);
      setMonth(loadedPosts[0]?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7));
      Promise.all(loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]] as const)).then((analyses) => {
        setLatestAnalysisByPostId(Object.fromEntries(analyses.filter(([, analysis]) => Boolean(analysis))));
      });
    });
  }, []);

  useEffect(() => {
    if (!month) return;
    loadMonthlyReportsData(accountId, month).then(setSavedReports);
  }, [accountId, month]);

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

  const categoryData = useMemo(() => {
    const monthly = posts.filter((post) => post.date.startsWith(month)).filter((post) => accountId === "all" || post.accountId === accountId);
    return postCategoryOptions.map((category) => {
      const items = monthly.filter((post) => (post.category ?? "other") === category.value);
      return {
        name: category.label,
        count: items.length,
        averageViews: Math.round(average(items.map((post) => post.views))),
        averageSaveRate: average(items.map((post) => getMetrics(post).saveRate)),
        averageEngagementRate: average(items.map((post) => getMetrics(post).engagementRate)),
        averageAiScore: average(items.map((post) => latestAnalysisByPostId[post.id]?.score ?? 0).filter((score) => score > 0)),
        sampleCaptions: items.slice(0, 3).map((post) => post.caption)
      };
    }).filter((item) => item.count > 0).sort((a, b) => b.averageSaveRate - a.averageSaveRate);
  }, [posts, month, accountId, latestAnalysisByPostId]);

  const displayReport = selectedReport ?? report;

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
      setSelectedReport(null);
    } catch (event) {
      setError(event instanceof Error ? event.message : "AI総評の作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const createCategoryAiReport = async () => {
    const account = accounts.find((item) => item.id === accountId) ?? null;
    setCategoryLoading(true);
    setError("");
    try {
      const response = await fetch("/api/category-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: categoryData, account, month })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "カテゴリ別AIレポートの作成に失敗しました。");
      setCategoryAiReport(data.report);
    } catch (event) {
      setError(event instanceof Error ? event.message : "カテゴリ別AIレポートの作成に失敗しました。");
    } finally {
      setCategoryLoading(false);
    }
  };

  const createSampleCategoryAiReport = () => {
    const strongest = [...categoryData].sort((a, b) => b.averageSaveRate - a.averageSaveRate)[0];
    const highScore = [...categoryData].sort((a, b) => b.averageAiScore - a.averageAiScore)[0];
    setCategoryAiReport({
      overall: strongest
        ? `${strongest.name}は保存率が高く、見返したい情報として機能しています。${highScore ? `${highScore.name}はAIスコア面で評価が高く、次月も軸にできます。` : ""}`
        : "カテゴリ別に投稿を登録すると、テーマごとの傾向を確認できます。",
      items: categoryData.map((category) => ({
        category: category.name,
        summary: `${category.count}件の投稿があり、平均表示数は${category.averageViews.toLocaleString()}、平均保存率は${formatPercent(category.averageSaveRate)}です。`,
        strength: category.averageSaveRate >= 1.5 ? "保存率が比較的高く、後で見返す価値を出せています。" : "投稿テーマとしての蓄積があり、改善検証の土台になります。",
        weakness: category.averageViews < average(categoryData.map((item) => item.averageViews)) ? "表示数の伸びには改善余地があります。" : "表示数は取れていますが、保存やコメントにつなげる工夫が必要です。",
        recommendation: "次回は冒頭で得られる価値を明確にし、保存したくなるチェックリストや比較要素を入れてください。"
      }))
    });
  };

  const saveCurrentReport = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    const account = accounts.find((item) => item.id === accountId);
    const saved = await saveMonthlyReportData(report, accountId === "all" ? null : accountId, account?.name ?? "すべて");
    if (saved) {
      setSavedReports((current) => [saved, ...current]);
      setSelectedReport(saved);
      setMessage("月次レポートを保存しました。");
    } else {
      setError("月次レポートの保存に失敗しました。サーバー保存設定を確認してください。");
    }
    setSaving(false);
  };

  const showSavedReport = (saved: MonthlyReportRecord) => {
    setSelectedReport(saved);
    setMonth(saved.month);
    setAccountId(saved.accountId ?? "all");
    setAiSummary(saved.summary);
    setMessage("保存済みレポートを再表示しています。");
  };

  const resetToCurrentReport = () => {
    setSelectedReport(null);
    setMessage("現在の投稿データから再計算したレポートを表示しています。");
  };

  return (
    <div>
      <PageHeader title="月次レポート" description="登録済み投稿を月別に集計し、伸びた投稿と改善が必要な投稿を確認します。" />
      <Panel className="mb-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label>対象月</label>
            <input className="mt-1" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setSelectedReport(null); }} />
          </div>
          <div>
            <label>アカウント</label>
            <select className="mt-1" value={accountId} onChange={(e) => { setAccountId(e.target.value); setSelectedReport(null); }}>
              <option value="all">すべて</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="合計表示数" value={displayReport.totalViews.toLocaleString()} />
        <Stat label="平均いいね数" value={Math.round(displayReport.averageLikes).toLocaleString()} />
        <Stat label="平均保存数" value={Math.round(displayReport.averageSaves).toLocaleString()} />
        <Stat label="平均エンゲージメント率" value={formatPercent(displayReport.averageEngagementRate)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Ranking title="伸びた投稿TOP3" posts={displayReport.topPosts} />
        <Ranking title="改善が必要な投稿TOP3" posts={displayReport.needsWorkPosts} />
      </div>
      <Panel className="mt-6">
        <h2 className="font-semibold">カテゴリ別の傾向</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {categoryData.map((item) => (
            <div key={item.name} className="rounded-md border border-stone-200 bg-white/80 p-3">
              <p className="font-semibold">{item.name}</p>
              <p className="mt-2 text-sm text-stone-600">投稿数: {item.count}件</p>
              <p className="mt-1 text-sm text-stone-600">平均表示数: {item.averageViews.toLocaleString()}</p>
              <p className="mt-1 text-sm text-stone-600">平均保存率: {formatPercent(item.averageSaveRate)}</p>
              <p className="mt-1 text-sm text-stone-600">平均AIスコア: {item.averageAiScore ? `${item.averageAiScore.toFixed(1)}点` : "未分析"}</p>
            </div>
          ))}
          {!categoryData.length ? <p className="text-sm text-stone-500">カテゴリ付き投稿がありません。</p> : null}
        </div>
      </Panel>
      <Panel className="mt-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={createCategoryAiReport} disabled={categoryLoading}>{categoryLoading ? "作成中..." : "カテゴリ別AIレポートを作成"}</Button>
          <Button variant="secondary" onClick={createSampleCategoryAiReport}>サンプルカテゴリレポート</Button>
        </div>
        <h2 className="font-semibold">カテゴリ別AIレポート</h2>
        {categoryAiReport ? (
          <div className="mt-4">
            <p className="rounded-md bg-skyglass px-3 py-3 text-sm leading-6 text-ink">{categoryAiReport.overall}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {categoryAiReport.items.map((item) => (
                <div key={item.category} className="rounded-md border border-stone-200 bg-white/80 p-4">
                  <h3 className="font-semibold">{item.category}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{item.summary}</p>
                  <p className="mt-3 text-sm leading-6"><span className="font-semibold">強み: </span>{item.strength}</p>
                  <p className="mt-2 text-sm leading-6"><span className="font-semibold">課題: </span>{item.weakness}</p>
                  <p className="mt-2 text-sm leading-6"><span className="font-semibold">次の方針: </span>{item.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="mt-2 text-sm leading-6 text-stone-600">カテゴリごとの表示数、保存率、AIスコアをもとに、伸びやすいテーマと改善余地をまとめます。</p>}
      </Panel>
      <Panel className="mt-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={createAiReport} disabled={loading}>{loading ? "作成中..." : "AI総評を作成"}</Button>
          <Button variant="secondary" onClick={() => { setAiSummary("リールは表示数獲得に強く、カルーセルは保存に貢献しています。来月は実演リールで認知を広げ、保存されるチェックリスト投稿で見込み顧客との接点を増やす方針が有効です。"); setSelectedReport(null); }}>サンプル総評</Button>
          <Button variant="secondary" onClick={saveCurrentReport} disabled={saving}>{saving ? "保存中..." : "月次レポートを保存"}</Button>
          {selectedReport ? <Button variant="secondary" onClick={resetToCurrentReport}>現在データに戻す</Button> : null}
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mb-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
        {selectedReport ? <p className="mb-4 rounded-md bg-fog px-3 py-2 text-sm text-stone-700">保存日時: {formatDateTime(selectedReport.createdAt)} / 対象: {selectedReport.accountName}</p> : null}
        <h2 className="font-semibold">AIによる総評</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">{displayReport.summary}</p>
        <h2 className="mt-5 font-semibold">来月の投稿方針</h2>
        <ul className="mt-2 grid gap-2">
          {displayReport.nextMonthPolicy.map((item) => <li className="rounded-md bg-stone-100 px-3 py-2 text-sm" key={item}>{item}</li>)}
        </ul>
      </Panel>
      <Panel className="mt-6">
        <h2 className="font-semibold">過去レポート一覧</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">同じ月・同じアカウントで保存したレポートを履歴として確認できます。</p>
        <div className="mt-4 grid gap-2">
          {savedReports.map((saved) => (
            <button
              key={saved.id}
              type="button"
              onClick={() => showSavedReport(saved)}
              className="flex flex-col gap-2 rounded-md border border-stone-200 bg-white/80 px-3 py-3 text-left hover:border-moss md:flex-row md:items-center md:justify-between"
            >
              <span>
                <span className="font-semibold">{saved.month} / {saved.accountName}</span>
                <span className="ml-2 text-sm text-stone-500">{formatDateTime(saved.createdAt)}</span>
              </span>
              <span className="text-sm text-stone-600">表示 {saved.totalViews.toLocaleString()} / ER {formatPercent(saved.averageEngagementRate)}</span>
            </button>
          ))}
          {!savedReports.length ? <p className="text-sm text-stone-500">保存済みレポートはまだありません。</p> : null}
        </div>
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
          <Link href={`/posts/detail?id=${post.id}`} key={post.id} className="block rounded-md border border-stone-200 p-3 hover:border-moss">
            <p className="text-sm font-semibold">{post.date} / ER {formatPercent(getMetrics(post).engagementRate)}</p>
            <p className="mt-1 line-clamp-2 text-sm text-stone-600">{post.caption}</p>
          </Link>
        ))}
        {!posts.length ? <p className="text-sm text-stone-500">対象月の投稿がありません。</p> : null}
      </div>
    </Panel>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
