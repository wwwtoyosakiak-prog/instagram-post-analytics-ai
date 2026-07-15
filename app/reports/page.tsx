"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { loadAccountsData, loadAllInsightData, loadAnalysesData, loadMonthlyReportsData, loadPostsData, saveMonthlyReportData } from "@/lib/cloud-storage";
import { AiAnalysisRecord, InstagramAccount, InstagramInsightSnapshot, InstagramPost, MonthlyReport, MonthlyReportRecord } from "@/lib/types";
import { average, formatPercent, getMetrics } from "@/lib/metrics";
import { calculateInsightGrowth, InsightGrowthSummary } from "@/lib/insight-growth";

export default function ReportsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [insightHistory, setInsightHistory] = useState<InstagramInsightSnapshot[]>([]);
  const [latestAnalysisByPostId, setLatestAnalysisByPostId] = useState<Record<string, AiAnalysisRecord>>({});
  const [accountId, setAccountId] = useState("all");
  const [month, setMonth] = useState("");
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [fiscalStartMonth, setFiscalStartMonth] = useState(4);
  const [aiSummary, setAiSummary] = useState("");
  const [savedReports, setSavedReports] = useState<MonthlyReportRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<MonthlyReportRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reportGeneratedAt, setReportGeneratedAt] = useState("");

  useEffect(() => {
    setReportGeneratedAt(new Date().toISOString());
    Promise.all([loadPostsData(), loadAccountsData(), loadAllInsightData()]).then(([loadedPosts, loadedAccounts, loadedInsights]) => {
      setPosts(loadedPosts);
      setAccounts(loadedAccounts);
      setInsightHistory(loadedInsights);
      const initialMonth = loadedPosts[0]?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
      setMonth(initialMonth);
      setFiscalYear(String(getFiscalYear(initialMonth, fiscalStartMonth)));
      Promise.all(loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]] as const)).then((analyses) => {
        setLatestAnalysisByPostId(Object.fromEntries(analyses.filter(([, analysis]) => Boolean(analysis))));
      });
    });
  }, [fiscalStartMonth]);

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

  const annualReport = useMemo(() => {
    const months = fiscalMonths(Number(fiscalYear), fiscalStartMonth);
    const monthSet = new Set(months);
    const annualPosts = posts.filter((post) => monthSet.has(post.date.slice(0, 7))).filter((post) => accountId === "all" || post.accountId === accountId);
    const ranked = [...annualPosts].sort((a, b) => getMetrics(b).engagementRate - getMetrics(a).engagementRate);
    const monthlyRows = months.map((targetMonth) => {
      const items = annualPosts.filter((post) => post.date.startsWith(targetMonth));
      return {
        month: targetMonth,
        posts: items.length,
        views: items.reduce((sum, post) => sum + post.views, 0),
        saves: items.reduce((sum, post) => sum + post.saves, 0),
        saveRate: average(items.map((post) => getMetrics(post).saveRate)),
        engagementRate: average(items.map((post) => getMetrics(post).engagementRate))
      };
    });
    return {
      months,
      posts: annualPosts,
      totalPosts: annualPosts.length,
      totalViews: annualPosts.reduce((sum, post) => sum + post.views, 0),
      totalSaves: annualPosts.reduce((sum, post) => sum + post.saves, 0),
      averageSaveRate: average(annualPosts.map((post) => getMetrics(post).saveRate)),
      averageEngagementRate: average(annualPosts.map((post) => getMetrics(post).engagementRate)),
      averageAiScore: average(annualPosts.map((post) => latestAnalysisByPostId[post.id]?.score ?? 0).filter((score) => score > 0)),
      topPosts: ranked.slice(0, 3),
      needsWorkPosts: ranked.slice(-3).reverse(),
      monthlyRows
    };
  }, [posts, latestAnalysisByPostId, fiscalYear, fiscalStartMonth, accountId]);

  const displayReport = selectedReport ?? report;

  const growthReport = useMemo(() => {
    const targetPosts = posts.filter((post) => accountId === "all" || post.accountId === accountId);
    return {
      week: calculateInsightGrowth(targetPosts, insightHistory, 7),
      month: calculateInsightGrowth(targetPosts, insightHistory, 30)
    };
  }, [posts, insightHistory, accountId]);

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

  const printReport = () => {
    window.print();
  };

  return (
    <div>
      <PageHeader title="月次レポート" description="登録済み投稿を月別に集計し、伸びた投稿と改善が必要な投稿を確認します。" />

      {/* 設定エリア */}
      <Panel className="mb-6">
        <div className="grid gap-3 md:grid-cols-1">
          <div>
            <label>対象月</label>
            <input className="mt-1" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setFiscalYear(String(getFiscalYear(e.target.value, fiscalStartMonth))); setSelectedReport(null); }} />
          </div>
        </div>
      </Panel>
      <Panel className="mb-6">
        <h2 className="font-semibold">年度集計</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label>対象年度</label>
            <input className="mt-1" type="number" min="2000" max="2100" value={fiscalYear} onChange={(event) => setFiscalYear(event.target.value)} />
          </div>
          <div>
            <label>年度の開始月</label>
            <select className="mt-1" value={fiscalStartMonth} onChange={(event) => setFiscalStartMonth(Number(event.target.value))}>
              <option value={1}>1月始まり</option>
              <option value={4}>4月始まり</option>
            </select>
          </div>
          <div>
            <label>対象期間</label>
            <div className="mt-1 rounded-md border border-stone-200 bg-white/80 px-3 py-2 text-sm font-semibold text-ink">
              {annualReport.months[0]} 〜 {annualReport.months[11]}
            </div>
          </div>
        </div>
      </Panel>

      <div className="print-area">
        {/* 印刷用見出し */}
        <Panel className="hidden print:block">
          <p className="text-xs font-semibold uppercase text-clay">Instagram Analytics Report</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">{displayReport.month} 月次レポート</h1>
          <p className="mt-2 text-sm text-stone-600">対象: このInstagramアカウント / 出力日時: {formatDateTime(reportGeneratedAt)}</p>
        </Panel>

        {/* 月次レポート本体 */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Stat label="合計表示数" value={displayReport.totalViews.toLocaleString()} />
          <Stat label="平均いいね数" value={Math.round(displayReport.averageLikes).toLocaleString()} />
          <Stat label="平均保存数" value={Math.round(displayReport.averageSaves).toLocaleString()} />
          <Stat label="平均エンゲージメント率" value={formatPercent(displayReport.averageEngagementRate)} />
        </div>
        <Panel className="mt-6">
          <h2 className="font-semibold">週次・月次の伸びレポート</h2>
          <p className="mt-2 text-sm text-stone-600">Instagram APIの同期履歴を基準に、閲覧数などの増加を集計しています。</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <GrowthReportBlock title="直近7日" summary={growthReport.week} />
            <GrowthReportBlock title="直近30日" summary={growthReport.month} />
          </div>
        </Panel>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Ranking title="伸びた投稿TOP3" posts={displayReport.topPosts} />
          <Ranking title="改善が必要な投稿TOP3" posts={displayReport.needsWorkPosts} />
        </div>
        <Panel className="mt-6">
          <h2 className="font-semibold">AIによる総評</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">{displayReport.summary}</p>
          <h2 className="mt-5 font-semibold">来月の投稿方針</h2>
          <ul className="mt-2 grid gap-2">
            {displayReport.nextMonthPolicy.map((item) => <li className="rounded-md bg-stone-100 px-3 py-2 text-sm" key={item}>{item}</li>)}
          </ul>
        </Panel>

        {/* 年度レポート本体 */}
        <Panel className="mt-6">
          <h2 className="font-semibold">{fiscalYear}年度レポート</h2>
          <p className="mt-2 text-sm text-stone-600">対象期間: {annualReport.months[0]} 〜 {annualReport.months[11]}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <Stat label="年間投稿数" value={`${annualReport.totalPosts}件`} />
            <Stat label="年間表示数" value={annualReport.totalViews.toLocaleString()} />
            <Stat label="年間保存数" value={annualReport.totalSaves.toLocaleString()} />
            <Stat label="平均保存率" value={formatPercent(annualReport.averageSaveRate)} />
            <Stat label="平均ER" value={formatPercent(annualReport.averageEngagementRate)} />
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2 pr-4">月</th>
                  <th className="py-2 pr-4">投稿</th>
                  <th className="py-2 pr-4">表示数</th>
                  <th className="py-2 pr-4">保存数</th>
                  <th className="py-2 pr-4">保存率</th>
                  <th className="py-2 pr-4">ER</th>
                </tr>
              </thead>
              <tbody>
                {annualReport.monthlyRows.map((row) => (
                  <tr key={row.month} className="border-b border-stone-100">
                    <td className="py-2 pr-4 font-semibold">{row.month}</td>
                    <td className="py-2 pr-4">{row.posts}件</td>
                    <td className="py-2 pr-4">{row.views.toLocaleString()}</td>
                    <td className="py-2 pr-4">{row.saves.toLocaleString()}</td>
                    <td className="py-2 pr-4">{formatPercent(row.saveRate)}</td>
                    <td className="py-2 pr-4">{formatPercent(row.engagementRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <AnnualRanking title="年度で伸びた投稿TOP3" posts={annualReport.topPosts} />
            <AnnualRanking title="年度で改善が必要な投稿TOP3" posts={annualReport.needsWorkPosts} />
          </div>
        </Panel>
      </div>

      {/* 操作エリア */}
      <Panel className="mt-6 print-hide">
        <h2 className="font-semibold">レポート操作</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={createAiReport} disabled={loading}>{loading ? "作成中..." : "AI総評を作成"}</Button>
          <Button variant="secondary" onClick={() => { setAiSummary("リールは表示数獲得に強く、カルーセルは保存に貢献しています。来月は実演リールで認知を広げ、保存されるチェックリスト投稿で見込み顧客との接点を増やす方針が有効です。"); setSelectedReport(null); }}>サンプル総評</Button>
          <Button variant="secondary" onClick={saveCurrentReport} disabled={saving}>{saving ? "保存中..." : "月次レポートを保存"}</Button>
          {selectedReport ? <Button variant="secondary" onClick={resetToCurrentReport}>現在データに戻す</Button> : null}
          <Button onClick={printReport}>PDF出力</Button>
        </div>
        <p className="mt-3 text-sm text-stone-600">PDF出力を押した後、印刷画面で「PDFとして保存」を選んでください。</p>
        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
        {selectedReport ? <p className="mt-4 rounded-md bg-fog px-3 py-2 text-sm text-stone-700">保存日時: {formatDateTime(selectedReport.createdAt)} / 対象: {selectedReport.accountName}</p> : null}
      </Panel>

      {/* 過去レポート一覧 */}
      <Panel className="mt-6 print-hide">
        <h2 className="font-semibold">過去レポート一覧</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">同じ月に保存したレポートを履歴として確認できます。</p>
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

function AnnualRanking({ title, posts }: { title: string; posts: InstagramPost[] }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white/80 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-3">
        {posts.map((post) => (
          <Link href={`/posts/detail?id=${post.id}`} key={post.id} className="block rounded-md border border-stone-200 p-3 hover:border-moss">
            <p className="text-sm font-semibold">{post.date} / ER {formatPercent(getMetrics(post).engagementRate)}</p>
            <p className="mt-1 line-clamp-2 text-sm text-stone-600">{post.caption}</p>
          </Link>
        ))}
        {!posts.length ? <p className="text-sm text-stone-500">対象年度の投稿がありません。</p> : null}
      </div>
    </div>
  );
}

function GrowthReportBlock({ title, summary }: { title: string; summary: InsightGrowthSummary }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white/80 p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p>閲覧増加: <strong>+{summary.viewsGrowth.toLocaleString()}</strong></p>
        <p>成長率: <strong>+{summary.viewsGrowthRate.toFixed(1)}%</strong></p>
        <p>リーチ増加: <strong>+{summary.reachGrowth.toLocaleString()}</strong></p>
        <p>保存増加: <strong>+{summary.savedGrowth.toLocaleString()}</strong></p>
        <p>シェア増加: <strong>+{summary.sharesGrowth.toLocaleString()}</strong></p>
        <p>総反応増加: <strong>+{summary.interactionsGrowth.toLocaleString()}</strong></p>
      </div>
      <h4 className="mt-4 text-sm font-semibold">伸びた投稿TOP3</h4>
      <div className="mt-2 grid gap-2">
        {summary.topPosts.map((item, index) => (
          <Link key={item.post.id} href={`/posts/detail?id=${item.post.id}`} className="flex justify-between gap-3 border-t border-stone-100 pt-2 text-sm hover:text-clay">
            <span className="line-clamp-1">{index + 1}. {item.post.caption || item.post.date}</span>
            <span className="shrink-0 font-semibold">+{item.viewsGrowth.toLocaleString()}</span>
          </Link>
        ))}
        {!summary.topPosts.length ? <p className="text-sm text-stone-500">同期履歴がまだありません。</p> : null}
      </div>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}

function fiscalMonths(year: number, startMonth: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = startMonth - 1 + index;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = (monthIndex % 12) + 1;
    return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  });
}

function getFiscalYear(month: string, startMonth: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return new Date().getFullYear();
  return monthNumber >= startMonth ? year : year - 1;
}
