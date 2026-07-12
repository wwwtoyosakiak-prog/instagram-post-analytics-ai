"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, Panel } from "@/components/ui";
import {
  dashboardInsight,
  summarizeCompetitorDashboard,
  summarizeOwnDashboard,
  type CompetitorDashboardPost,
} from "@/lib/competitor-dashboard";
import type { InstagramPost } from "@/lib/types";

type Competitor = {
  id: string;
  name: string;
  username: string;
};

export default function CompetitorDashboardPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ownPosts, setOwnPosts] = useState<InstagramPost[]>([]);
  const [competitorPosts, setCompetitorPosts] = useState<CompetitorDashboardPost[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [competitorResponse, ownResponse] = await Promise.all([
          fetch("/api/competitors", { cache: "no-store" }),
          fetch("/api/data/posts", { cache: "no-store" }),
        ]);

        const competitorData = await competitorResponse.json();
        const ownData = await ownResponse.json();

        if (!competitorResponse.ok) {
          throw new Error(competitorData.error ?? "競合一覧を取得できませんでした。");
        }

        setCompetitors(competitorData.competitors ?? []);
        if (ownResponse.ok) setOwnPosts(ownData.posts ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    }

    void loadInitial();
  }, []);

  async function selectCompetitor(id: string) {
    setSelectedId(id);
    setCompetitorPosts([]);
    setError("");

    if (!id) return;

    const response = await fetch(
      `/api/competitor-posts?competitorId=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "競合投稿を取得できませんでした。");
      return;
    }

    setCompetitorPosts(data.posts ?? []);
  }

  const ownSummary = useMemo(() => summarizeOwnDashboard(ownPosts), [ownPosts]);
  const competitorSummary = useMemo(
    () => summarizeCompetitorDashboard(competitorPosts),
    [competitorPosts],
  );

  const selectedCompetitor = competitors.find((item) => item.id === selectedId);

  const comparisonData = [
    { metric: "平均表示数", own: ownSummary.averageViews, competitor: competitorSummary.averageViews },
    { metric: "平均いいね", own: ownSummary.averageLikes, competitor: competitorSummary.averageLikes },
    { metric: "反応率", own: ownSummary.engagementRate, competitor: competitorSummary.engagementRate },
  ];

  const radarData = [
    {
      metric: "投稿数",
      own: normalize(ownSummary.posts, competitorSummary.posts),
      competitor: normalize(competitorSummary.posts, ownSummary.posts),
    },
    {
      metric: "表示数",
      own: normalize(ownSummary.averageViews, competitorSummary.averageViews),
      competitor: normalize(competitorSummary.averageViews, ownSummary.averageViews),
    },
    {
      metric: "反応率",
      own: normalize(ownSummary.engagementRate, competitorSummary.engagementRate),
      competitor: normalize(competitorSummary.engagementRate, ownSummary.engagementRate),
    },
    { metric: "リール率", own: ownSummary.reelRate, competitor: competitorSummary.reelRate },
    {
      metric: "カルーセル率",
      own: ownSummary.carouselRate,
      competitor: competitorSummary.carouselRate,
    },
  ];

  const timelineData = competitorPosts
    .slice()
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
    .slice(-30)
    .map((post) => ({
      date: post.postedAt.slice(5),
      views: post.views,
      interactions:
        post.likes + post.comments + (post.saves ?? 0) + (post.shares ?? 0),
    }));

  const insights = dashboardInsight(ownSummary, competitorSummary);

  return (
    <div>
      <PageHeader
        title="競合ダッシュボード"
        description="自アカウントと競合の投稿実績・投稿形式・反応率をまとめて比較します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-72 flex-1">
            <label>比較する競合</label>
            <select
              className="mt-1"
              value={selectedId}
              onChange={(event) => void selectCompetitor(event.target.value)}
            >
              <option value="">選択してください</option>
              {competitors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}（@{item.username}）
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/competitors"
            className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
          >
            競合データを管理
          </Link>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel><p className="text-sm text-stone-500">読み込んでいます...</p></Panel>
      ) : !selectedId ? (
        <Panel>
          <p className="text-sm leading-6 text-stone-600">
            比較する競合を選択してください。競合投稿が未登録の場合は、先に競合分析画面から登録します。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <h2 className="text-xl font-bold">
              自アカウント vs {selectedCompetitor?.name ?? "競合"}
            </h2>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="平均表示数" own={ownSummary.averageViews} competitor={competitorSummary.averageViews} />
            <MetricCard label="平均反応率" own={`${ownSummary.engagementRate}%`} competitor={`${competitorSummary.engagementRate}%`} />
            <MetricCard label="リール比率" own={`${ownSummary.reelRate}%`} competitor={`${competitorSummary.reelRate}%`} />
            <MetricCard label="投稿数" own={ownSummary.posts} competitor={competitorSummary.posts} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">主要指標比較</h2>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="own" name="自アカウント" />
                    <Bar dataKey="competitor" name="競合" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <h2 className="font-semibold">運用バランス</h2>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar dataKey="own" name="自アカウント" stroke="currentColor" fill="currentColor" fillOpacity={0.12} />
                    <Radar dataKey="competitor" name="競合" stroke="currentColor" fill="currentColor" fillOpacity={0.04} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel>
            <h2 className="font-semibold">競合投稿の表示数推移</h2>
            {!timelineData.length ? (
              <p className="mt-4 text-sm text-stone-500">競合投稿データがありません。</p>
            ) : (
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" minTickGap={20} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="views" name="表示数" stroke="currentColor" strokeWidth={3} />
                    <Line type="monotone" dataKey="interactions" name="反応数" stroke="currentColor" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="font-semibold">改善優先ポイント</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
              {insights.map((item) => (
                <li key={item} className="rounded-lg bg-fog px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

function normalize(value: number, comparison: number) {
  const maximum = Math.max(value, comparison, 1);
  return Math.round((value / maximum) * 100);
}

function MetricCard({
  label,
  own,
  competitor,
}: {
  label: string;
  own: number | string;
  competitor: number | string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-stone-500">自分</p>
          <p className="mt-1 text-xl font-bold">{own}</p>
        </div>
        <div>
          <p className="text-xs text-stone-500">競合</p>
          <p className="mt-1 text-xl font-bold">{competitor}</p>
        </div>
      </div>
    </div>
  );
}
