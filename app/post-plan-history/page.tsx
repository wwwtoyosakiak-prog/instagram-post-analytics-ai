"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  filterPostPlans,
  postPlanStatusLabels,
  type PostPlanStatus,
  type SavedPostPlan,
} from "@/lib/post-plan-history";

export default function PostPlanHistoryPage() {
  const [plans, setPlans] = useState<SavedPostPlan[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PostPlanStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPlans() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/post-plans", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "投稿企画を取得できませんでした。");
      }

      setPlans(data.plans ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "投稿企画を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  const filtered = useMemo(
    () => filterPostPlans(plans, query, status),
    [plans, query, status],
  );

  async function updatePlan(
    id: string,
    patch: {
      status?: PostPlanStatus;
      scheduledDate?: string | null;
    },
  ) {
    const response = await fetch("/api/post-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "更新できませんでした。");
      return;
    }

    setPlans((current) =>
      current.map((plan) => (plan.id === id ? data.plan : plan)),
    );
  }

  async function deletePlan(id: string) {
    if (!window.confirm("この投稿企画を削除しますか？")) return;

    const response = await fetch(
      `/api/post-plans?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "削除できませんでした。");
      return;
    }

    setPlans((current) => current.filter((plan) => plan.id !== id));
  }

  return (
    <div>
      <PageHeader
        title="AI投稿企画の履歴"
        description="保存した企画を、下書き・採用・制作中・投稿済みの状態で管理します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <label>キーワード検索</label>
            <input
              className="mt-1"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="企画名、テーマ、対象者、ハッシュタグ"
            />
          </div>

          <div className="min-w-48">
            <label>状態</label>
            <select
              className="mt-1"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as PostPlanStatus | "all")
              }
            >
              <option value="all">すべて</option>
              {Object.entries(postPlanStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/post-planner"
            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            新しい企画を作る
          </Link>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">読み込み中...</p>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <p className="text-sm text-stone-600">
            条件に一致する投稿企画はありません。
          </p>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filtered.map((plan) => (
            <Panel key={plan.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-skyglass px-3 py-1 text-xs font-semibold">
                    {postPlanStatusLabels[plan.status]}
                  </span>
                  <h2 className="mt-3 text-lg font-bold">{plan.title}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {plan.input.theme}・{postTypeLabel(plan.input.postType)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void deletePlan(plan.id)}
                  className="text-xs font-semibold text-red-600"
                >
                  削除
                </button>
              </div>

              <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {plan.result.caption}
              </p>

              <div className="mt-4">
                <label>進行状態</label>
                <select
                  className="mt-1"
                  value={plan.status}
                  onChange={(event) =>
                    void updatePlan(plan.id, {
                      status: event.target.value as PostPlanStatus,
                    })
                  }
                >
                  {Object.entries(postPlanStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                <label>投稿予定日</label>
                <input
                  className="mt-1"
                  type="date"
                  value={plan.scheduledDate ?? ""}
                  onChange={(event) =>
                    void updatePlan(plan.id, {
                      scheduledDate: event.target.value || null,
                    })
                  }
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <CopyButton label="キャプション" value={plan.result.caption} />
                <CopyButton
                  label="ハッシュタグ"
                  value={plan.result.hashtags.join(" ")}
                />
                <CopyButton label="CTA" value={plan.result.callToAction} />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyButton({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "コピー済み" : `${label}をコピー`}
    </Button>
  );
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
