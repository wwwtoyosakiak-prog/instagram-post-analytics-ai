"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  buildBaselinePrediction,
  evaluatePostKpis,
  type HistoricalPost,
  type KpiMetrics,
  type PostKpiPlan,
} from "@/lib/post-kpi";

export default function PostKpisPage() {
  const [plans, setPlans] = useState<PostKpiPlan[]>([]);
  const [posts, setPosts] = useState<HistoricalPost[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useEffectEvent(async () => {
      setLoading(true);
      setError("");

      try {
        const [plansResponse, postsResponse] = await Promise.all([
          fetch("/api/post-kpis", { cache: "no-store" }),
          fetch("/api/data/posts", { cache: "no-store" }),
        ]);

        const plansData = await plansResponse.json();
        const postsData = await postsResponse.json();

        if (!plansResponse.ok) {
          throw new Error(
            plansData.error ?? "KPI情報を取得できませんでした。",
          );
        }

        setPlans(plansData.plans ?? []);

        if (postsResponse.ok) {
          setPosts(
            (postsData.posts ?? []).map(
              (post: Record<string, unknown>) => ({
                id: String(post.id ?? ""),
                type: String(post.type ?? ""),
                date: String(post.date ?? ""),
                caption: String(post.caption ?? ""),
                views: Number(post.views ?? 0),
                likes: Number(post.likes ?? 0),
                comments: Number(post.comments ?? 0),
                saves: Number(post.saves ?? 0),
                shares: Number(post.shares ?? 0),
              }),
            ),
          );
        }

        if (!selectedId && plansData.plans?.[0]?.id) {
          setSelectedId(plansData.plans[0].id);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "データを取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    });

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedPlan = plans.find(
    (plan) => plan.id === selectedId,
  );

  const evaluation = useMemo(
    () =>
      selectedPlan
        ? evaluatePostKpis(
            selectedPlan.predicted,
            selectedPlan.actual,
          )
        : null,
    [selectedPlan],
  );

  async function updatePlan(
    id: string,
    patch: {
      linkedPostId?: string | null;
      predicted?: Partial<KpiMetrics>;
      actual?: Partial<KpiMetrics>;
      markEvaluated?: boolean;
    },
  ) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/post-kpis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json();

      if (!response.ok || !data.plan) {
        throw new Error(
          data.error ?? "KPI情報を更新できませんでした。",
        );
      }

      setPlans((current) =>
        current.map((plan) =>
          plan.id === id ? data.plan : plan,
        ),
      );
      setMessage("KPI情報を保存しました。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "KPI情報を更新できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  function createPrediction() {
    if (!selectedPlan) return;

    const baseline = buildBaselinePrediction(
      posts,
      selectedPlan.postType,
    );

    void updatePlan(selectedPlan.id, {
      predicted: baseline.prediction,
    });

    setMessage(
      baseline.sampleCount
        ? `${baseline.sampleCount}件の過去投稿を基準に予測しました。`
        : "過去データがないため、予測値は0になっています。",
    );
  }

  function importActual(postId: string) {
    if (!selectedPlan) return;

    const post = posts.find((item) => item.id === postId);

    if (!post) {
      void updatePlan(selectedPlan.id, {
        linkedPostId: null,
        actual: {
          views: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
        },
      });
      return;
    }

    void updatePlan(selectedPlan.id, {
      linkedPostId: post.id,
      actual: post,
      markEvaluated: true,
    });
  }

  return (
    <div>
      <PageHeader
        title="投稿KPI予測・実績評価"
        description="過去投稿を基準に目安値を作り、公開後の実績と達成率を比較します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-72 flex-1">
            <label>評価する投稿企画</label>
            <select
              className="mt-1"
              value={selectedId}
              onChange={(event) =>
                setSelectedId(event.target.value)
              }
            >
              <option value="">選択してください</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                  {plan.scheduledDate
                    ? `（${plan.scheduledDate}）`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/post-schedules"
            className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
          >
            投稿予約を確認
          </Link>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">{message}</p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">読み込み中...</p>
        </Panel>
      ) : !selectedPlan || !evaluation ? (
        <Panel>
          <p className="text-sm text-stone-600">
            評価する投稿企画を選択してください。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-stone-500">
                  {postTypeLabel(selectedPlan.postType)}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {selectedPlan.title}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {selectedPlan.theme}
                </p>
              </div>

              <Button
                onClick={createPrediction}
                disabled={saving}
              >
                過去実績から予測値を作成
              </Button>
            </div>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="表示数"
              evaluation={evaluation.views}
            />
            <MetricCard
              label="いいね"
              evaluation={evaluation.likes}
            />
            <MetricCard
              label="コメント"
              evaluation={evaluation.comments}
            />
            <MetricCard
              label="保存"
              evaluation={evaluation.saves}
            />
            <MetricCard
              label="シェア"
              evaluation={evaluation.shares}
            />
          </div>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">総合評価</h2>
                <p className="mt-2 text-3xl font-bold">
                  {evaluation.averageAchievementRate === null
                    ? "未評価"
                    : `${evaluation.averageAchievementRate}%`}
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  {ratingLabel(evaluation.rating)}
                </p>
              </div>

              <div className="min-w-80">
                <label>公開済み投稿を紐付ける</label>
                <select
                  className="mt-1"
                  value={selectedPlan.linkedPostId ?? ""}
                  onChange={(event) =>
                    importActual(event.target.value)
                  }
                >
                  <option value="">未選択</option>
                  {posts.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.date}・{post.type}・
                      {(post.caption ?? "").slice(0, 30)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <KpiEditor
              title="予測値"
              value={selectedPlan.predicted}
              disabled={saving}
              onSave={(value) =>
                void updatePlan(selectedPlan.id, {
                  predicted: value,
                })
              }
            />

            <KpiEditor
              title="実績値"
              value={selectedPlan.actual}
              disabled={saving}
              onSave={(value) =>
                void updatePlan(selectedPlan.id, {
                  actual: value,
                  markEvaluated: true,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function KpiEditor({
  title,
  value,
  disabled,
  onSave,
}: {
  title: string;
  value: KpiMetrics;
  disabled: boolean;
  onSave: (value: KpiMetrics) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Panel>
      <h2 className="font-semibold">{title}</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["views", "表示数"],
            ["likes", "いいね"],
            ["comments", "コメント"],
            ["saves", "保存"],
            ["shares", "シェア"],
          ] as Array<[keyof KpiMetrics, string]>
        ).map(([key, label]) => (
          <div key={key}>
            <label>{label}</label>
            <input
              className="mt-1"
              type="number"
              min="0"
              value={draft[key]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  [key]: Number(event.target.value),
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button
          onClick={() => onSave(draft)}
          disabled={disabled}
        >
          {title}を保存
        </Button>
      </div>
    </Panel>
  );
}

function MetricCard({
  label,
  evaluation,
}: {
  label: string;
  evaluation: {
    predicted: number;
    actual: number;
    difference: number;
    achievementRate: number | null;
  };
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-stone-500">予測</p>
          <p className="mt-1 text-xl font-bold">
            {evaluation.predicted.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500">実績</p>
          <p className="mt-1 text-xl font-bold">
            {evaluation.actual.toLocaleString()}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold">
        {evaluation.achievementRate === null
          ? "達成率—"
          : `達成率 ${evaluation.achievementRate}%`}
      </p>
      <p
        className={`mt-1 text-xs ${
          evaluation.difference >= 0
            ? "text-emerald-700"
            : "text-red-600"
        }`}
      >
        差分{" "}
        {evaluation.difference >= 0 ? "+" : ""}
        {evaluation.difference.toLocaleString()}
      </p>
    </div>
  );
}

function ratingLabel(
  rating:
    | "not_evaluated"
    | "excellent"
    | "good"
    | "near_target"
    | "below_target",
) {
  const labels = {
    not_evaluated: "公開後の実績を登録してください。",
    excellent: "予測を大きく上回っています。",
    good: "予測を達成しています。",
    near_target: "予測に近い結果です。",
    below_target: "予測を下回っています。投稿内容を振り返りましょう。",
  };

  return labels[rating];
}

function postTypeLabel(type: string) {
  const labels: Record<string, string> = {
    reel: "リール",
    carousel: "カルーセル",
    image: "画像",
    video: "動画",
  };

  return labels[type] ?? type;
}
