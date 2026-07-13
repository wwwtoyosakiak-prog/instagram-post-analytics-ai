"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import type {
  ManagerPriority,
  ManagerResult,
} from "@/lib/ai-manager";
import {
  buildDailySnapshotPayload,
  calculateTaskCompletion,
  type ManagerTaskState,
} from "@/lib/ai-manager-history";

export default function AiManagerPage() {
  const [manager, setManager] =
    useState<ManagerResult | null>(null);
  const [states, setStates] = useState<ManagerTaskState[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSnapshot, setSavingSnapshot] =
    useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadTaskStates(date: string) {
    const response = await fetch(
      `/api/ai-manager/tasks?date=${encodeURIComponent(date)}`,
      { cache: "no-store" },
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ?? "タスク状態を取得できませんでした。",
      );
    }

    setStates(data.states ?? []);
  }

  async function loadManager() {
    setLoading(true);
    setError("");
    setMessage("");

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
      await loadTaskStates(managerData.manager.today);
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

  const completion = useMemo(
    () =>
      calculateTaskCompletion(
        manager?.tasks.map((task) => task.id) ?? [],
        states,
      ),
    [manager, states],
  );

  function stateFor(taskKey: string) {
    return states.find(
      (state) => state.taskKey === taskKey,
    );
  }

  async function updateTask(
    task: ManagerResult["tasks"][number],
    patch: {
      isCompleted: boolean;
      note?: string;
    },
  ) {
    if (!manager) return;

    setError("");

    const response = await fetch(
      "/api/ai-manager/tasks",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskDate: manager.today,
          taskKey: task.id,
          title: task.title,
          isCompleted: patch.isCompleted,
          note:
            patch.note ??
            stateFor(task.id)?.note ??
            "",
        }),
      },
    );
    const data = await response.json();

    if (!response.ok || !data.state) {
      setError(
        data.error ?? "タスク状態を更新できませんでした。",
      );
      return;
    }

    setStates((current) => {
      const exists = current.some(
        (state) => state.taskKey === task.id,
      );

      return exists
        ? current.map((state) =>
            state.taskKey === task.id
              ? data.state
              : state,
          )
        : [...current, data.state];
    });
  }

  async function saveSnapshot() {
    if (!manager) return;

    setSavingSnapshot(true);
    setError("");
    setMessage("");

    try {
      const payload = buildDailySnapshotPayload(
        manager,
        states,
      );
      const response = await fetch(
        "/api/ai-manager/history",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "日次記録を保存できませんでした。",
        );
      }

      setMessage("今日の運用記録を保存しました。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "日次記録を保存できませんでした。",
      );
    } finally {
      setSavingSnapshot(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI運用マネージャー"
        description="今日やることを実行し、完了状況と運用スコアを記録します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm leading-6 text-stone-600">
              タスクを完了すると達成率へ反映されます。1日の終わりに運用記録を保存してください。
            </p>
            {manager ? (
              <p className="mt-2 text-sm font-semibold">
                本日の達成率：
                {completion.completedTasks}/
                {completion.totalTasks}件（
                {completion.completionRate}%）
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void loadManager()}
              disabled={loading}
            >
              {loading ? "更新中..." : "最新状態に更新"}
            </Button>
            <Button
              onClick={() => void saveSnapshot()}
              disabled={savingSnapshot || !manager}
            >
              {savingSnapshot
                ? "保存中..."
                : "今日の記録を保存"}
            </Button>
            <Link
              href="/ai-manager-history"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              運用履歴
            </Link>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            {message}
          </p>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <Score label="総合" value={manager.score.total} />
            <Score label="予定" value={manager.score.schedule} />
            <Score label="準備" value={manager.score.preparation} />
            <Score label="継続" value={manager.score.consistency} />
            <Score label="成長" value={manager.score.growth} />
            <Score
              label="達成率"
              value={completion.completionRate}
            />
          </div>

          <Panel>
            <h2 className="font-semibold">
              今日やること
            </h2>
            <div className="mt-4 space-y-3">
              {manager.tasks.length ? (
                manager.tasks.map((task) => {
                  const state = stateFor(task.id);
                  const completed =
                    state?.isCompleted ?? false;

                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border p-4 ${
                        completed
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-stone-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityClass(
                                task.priority,
                              )}`}
                            >
                              {priorityLabel(task.priority)}
                            </span>
                            {completed ? (
                              <span className="text-xs font-semibold text-emerald-700">
                                完了
                              </span>
                            ) : null}
                          </div>
                          <h3
                            className={`mt-3 font-bold ${
                              completed
                                ? "line-through opacity-70"
                                : ""
                            }`}
                          >
                            {task.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-stone-600">
                            {task.detail}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() =>
                              void updateTask(task, {
                                isCompleted: !completed,
                              })
                            }
                          >
                            {completed
                              ? "未完了に戻す"
                              : "完了にする"}
                          </Button>
                          <Link
                            href={task.actionUrl}
                            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
                          >
                            対応画面
                          </Link>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="text-xs">
                          作業メモ
                        </label>
                        <input
                          className="mt-1"
                          defaultValue={state?.note ?? ""}
                          placeholder="対応内容や次回へのメモ"
                          onBlur={(event) =>
                            void updateTask(task, {
                              isCompleted: completed,
                              note: event.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })
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

function Score({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
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

function priorityLabel(priority: ManagerPriority) {
  if (priority === "critical") return "最重要";
  if (priority === "high") return "優先";
  if (priority === "medium") return "通常";
  return "低";
}

function priorityClass(priority: ManagerPriority) {
  if (priority === "critical") {
    return "bg-red-100 text-red-800";
  }
  if (priority === "high") {
    return "bg-amber-100 text-amber-800";
  }
  if (priority === "medium") {
    return "bg-sky-100 text-sky-800";
  }
  return "bg-stone-100 text-stone-700";
}
