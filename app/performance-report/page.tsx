"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, PageHeader, Panel } from "@/components/ui";
import type {
  PerformanceReport,
  PerformanceReportAiSummary,
} from "@/lib/types";

type ReportResponse = {
  report?: PerformanceReport;
  error?: string;
};

type AiResponse = {
  summary?: PerformanceReportAiSummary;
  error?: string;
};

function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function PerformanceReportPage() {
  const initial = currentMonthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [accountId, setAccountId] = useState("");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [aiSummary, setAiSummary] =
    useState<PerformanceReportAiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const scoreData = useMemo(() => {
    if (!report) return [];

    return [
      { name: "内容", score: report.scoreBreakdown.content },
      { name: "画像・動画", score: report.scoreBreakdown.visual },
      { name: "キャプション", score: report.scoreBreakdown.caption },
      { name: "反応", score: report.scoreBreakdown.engagement },
      { name: "発見性", score: report.scoreBreakdown.discoverability },
    ];
  }, [report]);

  const loadReport = async () => {
    setLoading(true);
    setError("");
    setAiSummary(null);

    try {
      const params = new URLSearchParams({ from, to });
      if (accountId.trim()) params.set("accountId", accountId.trim());

      const response = await fetch(
        `/api/data/performance-report?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ReportResponse;

      if (!response.ok || !data.report) {
        throw new Error(data.error || "レポートを取得できませんでした。");
      }

      setReport(data.report);
    } catch (caught) {
      setReport(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "レポートを取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  };

  const createAiSummary = async () => {
    if (!report) return;

    setAiLoading(true);
    setError("");

    try {
      const response = await fetch("/api/report/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      const data = (await response.json()) as AiResponse;

      if (!response.ok || !data.summary) {
        throw new Error(data.error || "AI総評を作成できませんでした。");
      }

      setAiSummary(data.summary);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AI総評を作成できませんでした。",
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AIパフォーマンスレポート"
        description="指定期間の投稿実績・AIスコア・前期間比較をまとめ、次期戦略まで生成します。"
      />

      <Panel className="mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label>開始日</label>
            <input
              className="mt-1"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>

          <div>
            <label>終了日</label>
            <input
              className="mt-1"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>

          <div>
            <label>アカウントID（任意）</label>
            <input
              className="mt-1"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="空欄なら全アカウント"
            />
          </div>

          <div className="flex items-end">
            <Button onClick={() => void loadReport()} disabled={loading}>
              {loading ? "集計中..." : "レポートを集計"}
            </Button>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {!report ? (
        <Panel>
          <p className="text-sm leading-6 text-stone-600">
            期間を選び、「レポートを集計」を押してください。
          </p>
          <Link
            href="/reports"
            className="mt-3 inline-block text-sm font-semibold underline"
          >
            既存の月次レポートを見る
          </Link>
        </Panel>
      ) : (
        <div className="print-area space-y-6">
          <section className="hidden print:block">
            <p className="text-xs font-semibold uppercase text-stone-500">
              Instagram Analytics Report
            </p>
            <h1 className="mt-2 text-2xl font-bold text-ink">
              AIパフォーマンスレポート
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              対象期間: {report.period.from} 〜 {report.period.to}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              出力日時: {new Intl.DateTimeFormat("ja-JP", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date())}
            </p>
          </section>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-stone-500">
                  対象期間
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {report.period.from} 〜 {report.period.to}
                </h2>
              </div>

              <div className="print-hide flex flex-wrap gap-2">
                <Button
                  onClick={() => void createAiSummary()}
                  disabled={aiLoading}
                >
                  {aiLoading ? "AI分析中..." : "AI総評を作成"}
                </Button>
                <Button onClick={() => window.print()}>
                  PDF保存
                </Button>
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="投稿数"
              value={`${report.totals.posts}件`}
              change={report.comparison.posts}
            />
            <MetricCard
              label="合計表示数"
              value={report.totals.views.toLocaleString()}
              change={report.comparison.views}
            />
            <MetricCard
              label="平均保存率"
              value={`${report.averages.saveRate}%`}
              change={report.comparison.saves}
            />
            <MetricCard
              label="平均AIスコア"
              value={`${report.averages.aiScore}点`}
              change={report.comparison.aiScore}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">実績サマリー</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="リーチ" value={report.totals.reach} />
                <MiniStat label="いいね" value={report.totals.likes} />
                <MiniStat label="コメント" value={report.totals.comments} />
                <MiniStat label="保存" value={report.totals.saves} />
                <MiniStat label="シェア" value={report.totals.shares} />
                <MiniStat
                  label="平均反応率"
                  value={`${report.averages.engagementRate}%`}
                />
              </div>
            </Panel>

            <Panel>
              <h2 className="font-semibold">AIスコア平均</h2>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 20]} />
                    <Tooltip />
                    <Bar dataKey="score" name="平均スコア" fill="currentColor" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PostCard title="ベスト投稿" post={report.bestPost} />
            <PostCard
              title="改善余地のある投稿"
              post={report.needsWorkPost}
            />
          </div>

          {aiSummary ? <AiSummaryPanel summary={aiSummary} /> : null}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: number | null;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      <p
        className={`mt-2 text-sm font-semibold ${
          change == null
            ? "text-stone-500"
            : change >= 0
              ? "text-emerald-700"
              : "text-red-700"
        }`}
      >
        {change == null
          ? "前期間比較なし"
          : `前期間比 ${change >= 0 ? "+" : ""}${change}%`}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg bg-fog p-4">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function PostCard({
  title,
  post,
}: {
  title: string;
  post: PerformanceReport["bestPost"];
}) {
  return (
    <Panel>
      <h2 className="font-semibold">{title}</h2>
      {post ? (
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="font-semibold">投稿日：</span>
            {post.date}
          </p>
          <p>
            <span className="font-semibold">形式：</span>
            {post.type}
          </p>
          <p>
            <span className="font-semibold">表示数：</span>
            {post.views.toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">保存：</span>
            {post.saves}
          </p>
          <p className="line-clamp-4 leading-6 text-stone-700">
            {post.caption || "キャプションなし"}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-500">
          対象期間に投稿がありません。
        </p>
      )}
    </Panel>
  );
}

function AiSummaryPanel({
  summary,
}: {
  summary: PerformanceReportAiSummary;
}) {
  return (
    <Panel>
      <p className="text-xs font-semibold uppercase text-stone-500">
        AI Strategy
      </p>
      <h2 className="mt-1 text-xl font-bold">AI総評・次期戦略</h2>
      <p className="mt-4 leading-7 text-stone-700">
        {summary.overallSummary}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <SummaryList title="強み" items={summary.strengths} />
        <SummaryList title="改善点" items={summary.weaknesses} />
        <SummaryList title="次期の重点施策" items={summary.nextActions} />
        <SummaryList title="投稿テーマ案" items={summary.contentIdeas} />
        <SummaryList title="CTA候補" items={summary.recommendedCtas} />
        <SummaryList title="注意点" items={summary.risks} />
      </div>

      <div className="mt-5 rounded-lg bg-skyglass p-4">
        <h3 className="text-sm font-semibold">数値根拠</h3>
        <ul className="mt-2 space-y-2 text-sm text-stone-700">
          {summary.evidence.map((item) => (
            <li key={item}>・{item}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function SummaryList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-700">
        {items.length ? (
          items.map((item) => <li key={item}>・{item}</li>)
        ) : (
          <li>該当する提案はありません。</li>
        )}
      </ul>
    </div>
  );
}
