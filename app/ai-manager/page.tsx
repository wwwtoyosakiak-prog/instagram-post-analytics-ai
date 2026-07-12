"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import type {
  ManagerPriority,
  ManagerResult,
} from "@/lib/ai-manager";

export default function AiManagerPage() {
  const [manager, setManager] =
    useState<ManagerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadManager() {
    setLoading(true);
    setError("");

    try {
      const [
        schedulesResponse,
        notificationsResponse,
        pipelineResponse,
        postsResponse,
      ] = await Promise.all([
        fetch("/api/post-schedules", { cache: "no-store" }),
        fetch("/api/notifications", { cache: "no-store" }),
        fetch("/api/content-pipeline", { cache: "no-store" }),
        fetch("/api/data/posts", { cache: "no-store" }),
      ]);

      const schedulesData = await schedulesResponse.json();
      const notificationsData =
        await notificationsResponse.json();
      const pipelineData = await pipelineResponse.json();
      const postsData = await postsResponse.json();

      if (!schedulesResponse.ok) {
        throw new Error(
          schedulesData.error ??
            "投稿予定を取得できませんでした。",
        );
      }

      const growthResponse = await fetch(
        "/api/growth-strategy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            posts: postsResponse.ok
              ? postsData.posts ?? []
              : [],
          }),
        },
      );
      const growthData = await growthResponse.json();

      const managerResponse = await fetch(
        "/api/ai-manager",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schedules: schedulesData.posts ?? [],
            notifications:
              notificationsResponse.ok
                ? notificationsData.notifications ?? []
                : [],
            pipelineCards: pipelineResponse.ok
              ? pipelineData.cards ?? []
              : [],
            growthStrategy: growthResponse.ok
              ? growthData.strategy
              : null,
            weekTarget: 3,
          }),
        },
      );
      const managerData = await managerResponse.json();

      if (!managerResponse.ok || !managerData.manager) {
        throw new Error(
          managerData.error ??
            "運用マネージャーを作成できませんでした。",
        );
      }

      setManager(managerData.manager);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "運用マネージャーを作成できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadManager();
  }, []);

  return (
    <div>
      <PageHeader
        title="AI運用マネージャー"
        description="今日やること、投稿準備、期限、成長状況を一画面で確認します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            投稿予約・通知・制作工程・成長戦略を統合し、優先順位を自動整理します。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void loadManager()}
              disabled={loading}
            >
              {loading ? "更新中..." : "最新状態に更新"}
            </Button>
            <Link
              href="/operation-consultant"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              AI運用コンサル
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
            運用状況を集計中...
          </p>
        </Panel>
      ) : !manager ? (
        <Panel>
          <p className="text-sm text-stone-600">
            集計結果がありません。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <ScoreCard label="総合" value={manager.score.total} />
            <ScoreCard label="予定管理" value={manager.score.schedule} />
            <ScoreCard label="投稿準備" value={manager.score.preparation} />
            <ScoreCard label="継続性" value={manager.score.consistency} />
            <ScoreCard label="成長" value={manager.score.growth} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <Metric label="本日投稿" value={`${manager.summary.todayPosts}件`} />
            <Metric label="明日投稿" value={`${manager.summary.tomorrowPosts}件`} />
            <Metric label="期限超過" value={`${manager.summary.overduePosts}件`} />
            <Metric label="未読通知" value={`${manager.summary.unreadNotifications}件`} />
            <Metric label="準備不足" value={`${manager.summary.incompletePosts}件`} />
            <Metric label="今週の残り" value={`${manager.summary.remainingPosts}投稿`} />
          </div>

          <Panel>
            <h2 className="font-semibold">今日やること</h2>
            <div className="mt-4 space-y-3">
              {manager.tasks.length ? (
                manager.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityClass(
                          task.priority,
                        )}`}
                      >
                        {priorityLabel(task.priority)}
                      </span>
                      <h3 className="mt-3 font-bold">{task.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {task.detail}
                      </p>
                    </div>
                    <Link
                      href={task.actionUrl}
                      className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
                    >
                      対応する
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-500">
                  緊急のタスクはありません。
                </p>
              )}
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">AI警告</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                {manager.warnings.length ? (
                  manager.warnings.map((warning) => (
                    <li key={warning}>・{warning}</li>
                  ))
                ) : (
                  <li>大きな警告はありません。</li>
                )}
              </ul>
            </Panel>

            <Panel>
              <h2 className="font-semibold">
                AIコーチ用コンテキスト
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-700">
                {manager.coachContext}
              </p>
              <div className="mt-4">
                <Link
                  href="/ai-chat"
                  className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
                >
                  AIチャットで相談
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-4">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function priorityLabel(priority: ManagerPriority) {
  if (priority === "critical") return "最重要";
  if (priority === "high") return "優先";
  if (priority === "medium") return "通常";
  return "低";
}

function priorityClass(priority: ManagerPriority) {
  if (priority === "critical") return "bg-red-100 text-red-800";
  if (priority === "high") return "bg-amber-100 text-amber-800";
  if (priority === "medium") return "bg-sky-100 text-sky-800";
  return "bg-stone-100 text-stone-700";
}
