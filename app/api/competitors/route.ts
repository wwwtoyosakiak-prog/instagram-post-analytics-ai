import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function request<T>(path: string, init: RequestInit = {}) {
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

  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function GET() {
  try {
    const rows = await request<Record<string, unknown>[]>(
      "competitor_accounts?select=*&order=created_at.desc",
    );
    return NextResponse.json({ competitors: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function POST(requestObject: Request) {
  const body = (await requestObject.json()) as {
    name?: string;
    username?: string;
  };

  if (!body.name?.trim() || !body.username?.trim()) {
    return NextResponse.json(
      { error: "名称とユーザー名は必須です。" },
      { status: 400 },
    );
  }

  try {
    const rows = await request<Record<string, unknown>[]>("competitor_accounts", {
      method: "POST",
      body: JSON.stringify({
        name: body.name.trim(),
        username: body.username.trim().replace(/^@/, ""),
      }),
    });
    return NextResponse.json({ competitor: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登録に失敗しました。" },
      { status: 500 },
    );
  }
}
