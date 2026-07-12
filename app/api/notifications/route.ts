import { NextRequest, NextResponse } from "next/server";
import type {
  NotificationSeverity,
  OperationNotification,
} from "@/lib/notification-center";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type NotificationRow = {
  id: string;
  source_type: string;
  source_id: string | null;
  notification_type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action_url: string | null;
  dedupe_key: string;
  is_read: boolean;
  occurred_at: string;
  read_at: string | null;
};

type PatchBody = {
  id?: string;
  isRead?: boolean;
  markAllRead?: boolean;
};

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      (await response.text()) || "Supabase request failed.",
    );
  }

  return response.json() as Promise<T>;
}

function mapRow(row: NotificationRow): OperationNotification {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    notificationType: row.notification_type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    actionUrl: row.action_url,
    dedupeKey: row.dedupe_key,
    isRead: row.is_read,
    occurredAt: row.occurred_at,
    readAt: row.read_at,
  };
}

export async function GET(requestObject: NextRequest) {
  const unreadOnly =
    requestObject.nextUrl.searchParams.get("unreadOnly") === "true";

  const filter = unreadOnly ? "&is_read=eq.false" : "";

  try {
    const rows = await request<NotificationRow[]>(
      `operation_notifications?select=*&order=occurred_at.desc${filter}`,
    );

    return NextResponse.json({
      notifications: rows.map(mapRow),
      unreadCount: rows.filter((row) => !row.is_read).length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "通知を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(requestObject: Request) {
  let body: PatchBody;

  try {
    body = (await requestObject.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  try {
    if (body.markAllRead) {
      await request<NotificationRow[]>(
        "operation_notifications?is_read=eq.false",
        {
          method: "PATCH",
          body: JSON.stringify({
            is_read: true,
            read_at: now,
          }),
        },
      );

      return NextResponse.json({ success: true });
    }

    if (!body.id || typeof body.isRead !== "boolean") {
      return NextResponse.json(
        { error: "通知IDと既読状態が必要です。" },
        { status: 400 },
      );
    }

    const rows = await request<NotificationRow[]>(
      `operation_notifications?id=eq.${encodeURIComponent(body.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          is_read: body.isRead,
          read_at: body.isRead ? now : null,
        }),
      },
    );

    return NextResponse.json({
      notification: mapRow(rows[0]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "通知を更新できませんでした。",
      },
      { status: 500 },
    );
  }
}
