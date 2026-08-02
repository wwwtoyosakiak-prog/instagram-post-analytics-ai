import { NextRequest, NextResponse } from "next/server";
import { authenticateAppUser, createSession, sessionMaxAge, SESSION_COOKIE } from "@/lib/app-auth";
import { authenticateStoredUser } from "@/lib/app-user-store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  const username = body.username?.trim() ?? "";
  let result = authenticateAppUser(username, body.password ?? "");
  if (result.status === "invalid_credentials" && process.env.USER_DATA_OWNERSHIP_ENABLED === "true") {
    const stored = await authenticateStoredUser(username, body.password ?? "");
    if (stored) result = { status: "authenticated", ...stored };
  }
  if (result.status === "invalid_configuration") {
    return NextResponse.json({ error: "ログイン設定を確認してください。" }, { status: 503 });
  }
  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "IDまたはパスワードが正しくありません。" }, { status: 401 });
  }
  if (!process.env.APP_SESSION_SECRET) {
    return NextResponse.json({ error: "ログイン画面はまだ有効になっていません。" }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSession(result.ownerId, result.role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return response;
}
