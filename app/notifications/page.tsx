"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  sortNotifications,
  type NotificationSeverity,
  type OperationNotification,
} from "@/lib/notification-center";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<
    OperationNotification[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "通知を取得できませんでした。",
        );
      }

      setNotifications(data.notifications ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "通知を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function generateNotifications() {
    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/notifications/generate", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "通知を生成できませんでした。",
        );
      }

      await loadNotifications();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "通知を生成できませんでした。",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function markRead(
    notification: OperationNotification,
    isRead: boolean,
  ) {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: notification.id,
        isRead,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "通知を更新できませんでした。");
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? data.notification
          : item,
      ),
    );
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "通知を更新できませんでした。");
      return;
    }

    const now = new Date().toISOString();

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        isRead: true,
        readAt: now,
      })),
    );
  }

  const visible = useMemo(() => {
    const filtered = showUnreadOnly
      ? notifications.filter((item) => !item.isRead)
      : notifications;

    return sortNotifications(filtered);
  }, [notifications, showUnreadOnly]);

  const unreadCount = notifications.filter(
    (item) => !item.isRead,
  ).length;

  return (
    <div>
      <PageHeader
        title="通知センター"
        description="投稿予定、準備不足、期限超過など、運用上の注意をまとめて確認します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">
              未読通知：{unreadCount}件
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(event) =>
                  setShowUnreadOnly(event.target.checked)
                }
              />
              未読だけ表示
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void generateNotifications()}
              disabled={generating}
            >
              {generating ? "確認中..." : "最新状態から通知を生成"}
            </Button>
            <Button onClick={() => void markAllRead()}>
              すべて既読にする
            </Button>
            <Link
              href="/post-schedules"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              投稿予約を確認
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
      ) : visible.length === 0 ? (
        <Panel>
          <p className="text-sm text-stone-600">
            表示する通知はありません。
          </p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {visible.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onReadChange={(isRead) =>
                void markRead(notification, isRead)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  onReadChange,
}: {
  notification: OperationNotification;
  onReadChange: (isRead: boolean) => void;
}) {
  return (
    <Panel
      className={
        notification.isRead
          ? "opacity-70"
          : severityClass(notification.severity)
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
              {severityLabel(notification.severity)}
            </span>
            {!notification.isRead ? (
              <span className="text-xs font-semibold text-red-600">
                未読
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 font-bold">
            {notification.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {notification.message}
          </p>
          <p className="mt-3 text-xs text-stone-500">
            {new Date(notification.occurredAt).toLocaleString(
              "ja-JP",
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {notification.actionUrl ? (
            <Link
              href={notification.actionUrl}
              className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
            >
              確認する
            </Link>
          ) : null}

          <Button
            onClick={() =>
              onReadChange(!notification.isRead)
            }
          >
            {notification.isRead ? "未読に戻す" : "既読にする"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function severityLabel(severity: NotificationSeverity) {
  if (severity === "critical") return "重要";
  if (severity === "warning") return "注意";
  return "お知らせ";
}

function severityClass(severity: NotificationSeverity) {
  if (severity === "critical") {
    return "border-red-200 bg-red-50";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50";
  }
  return "border-sky-200 bg-sky-50";
}
