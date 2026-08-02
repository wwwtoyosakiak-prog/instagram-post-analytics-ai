import { NextRequest, NextResponse } from "next/server";
import { createStoredUser, listStoredUsers, updateStoredUser } from "@/lib/app-user-store";
import { isAuthenticatedAdmin } from "@/lib/authenticated-user";

function forbidden(request: Request) {
  return isAuthenticatedAdmin(request) ? null : NextResponse.json({ error: "管理者だけが操作できます。" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const denied = forbidden(request); if (denied) return denied;
  return NextResponse.json({ users: await listStoredUsers() });
}

export async function POST(request: NextRequest) {
  const denied = forbidden(request); if (denied) return denied;
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string; role?: string };
  const username = body.username?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) return NextResponse.json({ error: "ユーザーIDは3〜32文字の英数字で入力してください。" }, { status: 400 });
  if (!body.password || body.password.length < 12) return NextResponse.json({ error: "パスワードは12文字以上にしてください。" }, { status: 400 });
  try {
    return NextResponse.json({ user: await createStoredUser(username, body.password, body.role === "admin" ? "admin" : "member") }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "同じユーザーIDが登録済みです。" }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = forbidden(request); if (denied) return denied;
  const body = await request.json().catch(() => ({})) as { id?: string; password?: string; role?: string; active?: boolean };
  if (!body.id) return NextResponse.json({ error: "対象ユーザーが不明です。" }, { status: 400 });
  if (body.password && body.password.length < 12) return NextResponse.json({ error: "パスワードは12文字以上にしてください。" }, { status: 400 });
  const user = await updateStoredUser(body.id, { password: body.password, role: body.role === "admin" ? "admin" : body.role === "member" ? "member" : undefined, active: body.active });
  return NextResponse.json({ user });
}
