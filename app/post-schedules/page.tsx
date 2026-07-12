"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import {
  findScheduleGaps,
  postsForDate,
  scheduleReadiness,
  scheduleStatusLabels,
  sortScheduledPosts,
  type ScheduledPost,
  type ScheduleStatus,
} from "@/lib/post-scheduling";

function initialMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function PostSchedulesPage() {
  const [month, setMonth] = useState(initialMonth());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPosts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/post-schedules", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "投稿予定を取得できませんでした。",
        );
      }

      setPosts(data.posts ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "投稿予定を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  async function updatePost(
    id: string,
    patch: {
      scheduledDate?: string | null;
      scheduledTime?: string | null;
      scheduleStatus?: ScheduleStatus;
      reminderEnabled?: boolean;
    },
  ) {
    const previous = posts;

    setPosts((current) =>
      current.map((post) =>
        post.id === id ? { ...post, ...patch } : post,
      ),
    );

    const response = await fetch("/api/post-schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await response.json();

    if (!response.ok || !data.post) {
      setPosts(previous);
      setError(data.error ?? "更新できませんでした。");
      return;
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === id ? data.post : post,
      ),
    );
  }

  const monthDays = useMemo(
    () => buildMonthDays(month),
    [month],
  );

  const monthStart = `${month}-01`;
  const gaps = useMemo(
    () => findScheduleGaps(posts, monthStart, monthDays.length, 3),
    [posts, monthStart, monthDays.length],
  );

  const selectedPosts = selectedDate
    ? postsForDate(posts, selectedDate)
    : [];

  const upcoming = sortScheduledPosts(posts).filter(
    (post) =>
      post.scheduledDate &&
      post.scheduleStatus !== "cancelled" &&
      post.scheduleStatus !== "published",
  );

  return (
    <div>
      <PageHeader
        title="投稿予約・スケジュール"
        description="投稿予定日時、公開準備、投稿間隔をまとめて管理します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label>表示する月</label>
            <input
              className="mt-1"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setSelectedDate(null);
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/post-planner"
              className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
            >
              投稿企画を作る
            </Link>
            <Link
              href="/content-pipeline"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              制作パイプライン
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
          <p className="text-sm text-stone-500">読み込み中...</p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <h2 className="font-semibold">月間投稿カレンダー</h2>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-stone-500">
              {["日", "月", "火", "水", "木", "金", "土"].map(
                (day) => (
                  <div key={day}>{day}</div>
                ),
              )}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthDays.map((day) =>
                day.date ? (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={`min-h-28 rounded-lg border p-2 text-left ${
                      selectedDate === day.date
                        ? "border-ink bg-skyglass"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      {Number(day.date.slice(-2))}
                    </span>
                    <div className="mt-2 space-y-1">
                      {postsForDate(posts, day.date)
                        .slice(0, 3)
                        .map((post) => (
                          <div
                            key={post.id}
                            className="truncate rounded bg-fog px-2 py-1 text-xs"
                          >
                            {post.scheduledTime?.slice(0, 5) ??
                              "--:--"}{" "}
                            {post.title}
                          </div>
                        ))}
                    </div>
                  </button>
                ) : (
                  <div
                    key={day.key}
                    className="min-h-28 rounded-lg bg-stone-50"
                  />
                ),
              )}
            </div>
          </Panel>

          {selectedDate ? (
            <Panel>
              <h2 className="font-semibold">
                {selectedDate} の投稿予定
              </h2>
              {!selectedPosts.length ? (
                <p className="mt-4 text-sm text-stone-500">
                  この日の投稿予定はありません。
                </p>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {selectedPosts.map((post) => (
                    <ScheduleEditor
                      key={post.id}
                      post={post}
                      onUpdate={(patch) =>
                        void updatePost(post.id, patch)
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <Panel>
              <h2 className="font-semibold">投稿予定一覧</h2>

              {!upcoming.length ? (
                <p className="mt-4 text-sm text-stone-500">
                  投稿予定はまだありません。企画履歴または制作パイプラインで投稿予定日を設定してください。
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {upcoming.map((post) => (
                    <ScheduleEditor
                      key={post.id}
                      post={post}
                      onUpdate={(patch) =>
                        void updatePost(post.id, patch)
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <h2 className="font-semibold">投稿間隔チェック</h2>
              <div className="mt-4 space-y-3">
                {gaps.map((week) => (
                  <div
                    key={week.weekStart}
                    className="rounded-lg bg-fog p-4"
                  >
                    <p className="text-sm font-semibold">
                      {week.weekStart} からの週
                    </p>
                    <p className="mt-1 text-xs text-stone-600">
                      予定 {week.scheduledCount}件／目安 3件
                    </p>

                    {week.missingCount > 0 ? (
                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        あと{week.missingCount}件の投稿枠があります。
                        候補日：
                        {week.suggestedDates.join("、") || "調整中"}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-emerald-700">
                        今週の投稿枠は埋まっています。
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleEditor({
  post,
  onUpdate,
}: {
  post: ScheduledPost;
  onUpdate: (patch: {
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    scheduleStatus?: ScheduleStatus;
    reminderEnabled?: boolean;
  }) => void;
}) {
  const readiness = scheduleReadiness(post);

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-500">
            {postTypeLabel(post.postType)}
          </p>
          <h3 className="mt-1 font-bold">{post.title}</h3>
          <p className="mt-1 text-xs text-stone-500">
            {post.theme}
          </p>
        </div>
        <span className="rounded-full bg-skyglass px-3 py-1 text-xs font-semibold">
          準備 {readiness.percentage}%
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs">投稿予定日</label>
          <input
            className="mt-1"
            type="date"
            value={post.scheduledDate ?? ""}
            onChange={(event) =>
              onUpdate({
                scheduledDate: event.target.value || null,
              })
            }
          />
        </div>

        <div>
          <label className="text-xs">投稿時刻</label>
          <input
            className="mt-1"
            type="time"
            value={post.scheduledTime?.slice(0, 5) ?? ""}
            onChange={(event) =>
              onUpdate({
                scheduledTime: event.target.value || null,
              })
            }
          />
        </div>

        <div>
          <label className="text-xs">予約状態</label>
          <select
            className="mt-1"
            value={post.scheduleStatus}
            onChange={(event) =>
              onUpdate({
                scheduleStatus:
                  event.target.value as ScheduleStatus,
              })
            }
          >
            {Object.entries(scheduleStatusLabels).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>

        <label className="flex items-center gap-2 pt-6 text-sm">
          <input
            type="checkbox"
            checked={post.reminderEnabled}
            onChange={(event) =>
              onUpdate({
                reminderEnabled: event.target.checked,
              })
            }
          />
          投稿忘れ防止を有効
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-stone-500">
          公開準備チェック
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {readiness.checks.map((check) => (
            <span
              key={check.key}
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                check.complete
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-stone-100 text-stone-500"
              }`}
            >
              {check.complete ? "✓" : "○"} {check.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function buildMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const last = new Date(year, monthNumber, 0);
  const result: Array<{
    key: string;
    date: string | null;
  }> = [];

  for (let index = 0; index < first.getDay(); index += 1) {
    result.push({
      key: `blank-start-${index}`,
      date: null,
    });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    result.push({
      key: `${month}-${day}`,
      date: `${month}-${String(day).padStart(2, "0")}`,
    });
  }

  while (result.length % 7 !== 0) {
    result.push({
      key: `blank-end-${result.length}`,
      date: null,
    });
  }

  return result;
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
