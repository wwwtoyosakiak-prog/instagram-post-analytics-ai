"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import type {
  GrowthPost,
  GrowthStrategyResult,
} from "@/lib/growth-strategy";

export default function GrowthStrategyPage() {
  const [strategy, setStrategy] =
    useState<GrowthStrategyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStrategy() {
    setLoading(true);
    setError("");

    try {
      const postsResponse = await fetch("/api/data/posts", {
        cache: "no-store",
      });
      const postsData = await postsResponse.json();

      if (!postsResponse.ok) {
        throw new Error(
          postsData.error ?? "投稿データを取得できませんでした。",
        );
      }

      const response = await fetch("/api/growth-strategy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          posts: postsData.posts ?? [],
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.strategy) {
        throw new Error(
          data.error ?? "成長戦略を作成できませんでした。",
        );
      }

      setStrategy(data.strategy);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "成長戦略を作成できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStrategy();
  }, []);

  return (
    <div>
      <PageHeader
        title="アカウント成長戦略"
        description="過去投稿の実績から、強み・改善余地・4週間の実行計画を整理します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            表示されるスコアや曜日評価は、取得済み投稿だけを使った相対評価です。成果やフォロワー増加を保証するものではありません。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadStrategy()}
              className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
            >
              再分析
            </button>
            <Link
              href="/post-retrospectives"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              投稿振り返り
            </Link>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">
            成長戦略を計算中...
          </p>
        </Panel>
      ) : !strategy ? (
        <Panel>
          <p className="text-sm text-stone-600">
            分析結果がありません。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <MetricCard
              label="成長スコア"
              value={`${strategy.score}/100`}
            />
            <MetricCard
              label="対象投稿"
              value={`${strategy.summary.postCount}件`}
            />
            <MetricCard
              label="週あたり投稿"
              value={`${strategy.summary.postsPerWeek}本`}
            />
            <MetricCard
              label="平均表示数"
              value={strategy.summary.averageViews.toLocaleString()}
            />
            <MetricCard
              label="平均保存率"
              value={`${strategy.summary.averageSaveRate}%`}
            />
            <MetricCard
              label="平均シェア率"
              value={`${strategy.summary.averageShareRate}%`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">強み</h2>
              <List items={strategy.strengths} />
            </Panel>

            <Panel>
              <h2 className="font-semibold">改善余地・注意点</h2>
              <List items={strategy.risks} />
            </Panel>
          </div>

          <Panel>
            <h2 className="font-semibold">投稿形式の構成</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-stone-500">
                    <th className="px-3 py-3">形式</th>
                    <th className="px-3 py-3">投稿数</th>
                    <th className="px-3 py-3">構成比</th>
                    <th className="px-3 py-3">平均表示数</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.contentMix.map((item) => (
                    <tr
                      key={item.type}
                      className="border-b border-stone-100"
                    >
                      <td className="px-3 py-3 font-semibold">
                        {postTypeLabel(item.type)}
                      </td>
                      <td className="px-3 py-3">{item.count}</td>
                      <td className="px-3 py-3">
                        {item.percentage}%
                      </td>
                      <td className="px-3 py-3">
                        {item.averageViews.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <PerformancePanel
              title="曜日別成果"
              items={strategy.weekdayPerformance}
            />
            <PerformancePanel
              title="時間帯別成果"
              items={strategy.hourPerformance}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PostRanking
              title="上位投稿"
              posts={strategy.topPosts}
            />
            <PostRanking
              title="下位投稿"
              posts={strategy.bottomPosts}
            />
          </div>

          <Panel>
            <h2 className="font-semibold">
              4週間の改善ロードマップ
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {strategy.roadmap.map((item) => (
                <div
                  key={item.week}
                  className="rounded-lg border border-stone-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold text-stone-500">
                    WEEK {item.week}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">
                    {item.focus}
                  </h3>
                  <List items={item.actions} />
                  <p className="mt-4 rounded-md bg-fog p-3 text-sm leading-6">
                    <strong>確認指標：</strong>
                    {item.measurement}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
      {items.length ? (
        items.map((item) => <li key={item}>・{item}</li>)
      ) : (
        <li>十分なデータがありません。</li>
      )}
    </ul>
  );
}

function PerformancePanel({
  title,
  items,
}: {
  title: string;
  items: Array<{
    label: string;
    value: number;
    postCount: number;
  }>;
}) {
  const maximum = Math.max(
    1,
    ...items.map((item) => item.value),
  );

  return (
    <Panel>
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">
        {items.length ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {item.label}
                </span>
                <span className="text-stone-500">
                  {item.postCount}件
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{
                    width: `${Math.max(
                      4,
                      (item.value / maximum) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-stone-500">
                相対成果スコア {item.value}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">
            分析可能なデータがありません。
          </p>
        )}
      </div>
    </Panel>
  );
}

function PostRanking({
  title,
  posts,
}: {
  title: string;
  posts: GrowthPost[];
}) {
  return (
    <Panel>
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {posts.length ? (
          posts.map((post) => (
            <div
              key={post.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-500">
                  {post.date.slice(0, 10)}・
                  {postTypeLabel(post.type)}
                </span>
                <span className="text-sm font-bold">
                  表示 {post.views.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-6">
                {post.caption || "キャプションなし"}
              </p>
              <p className="mt-3 text-xs text-stone-500">
                いいね {post.likes}／コメント {post.comments}／
                保存 {post.saves}／シェア {post.shares}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">
            投稿データがありません。
          </p>
        )}
      </div>
    </Panel>
  );
}

function postTypeLabel(type: string) {
  const labels: Record<string, string> = {
    reel: "リール",
    reels: "リール",
    carousel: "カルーセル",
    carousel_album: "カルーセル",
    image: "画像",
    video: "動画",
  };

  return labels[type] ?? type;
}
