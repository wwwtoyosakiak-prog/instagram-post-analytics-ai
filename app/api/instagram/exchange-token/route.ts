// 交換専用。結果をVercel環境変数 INSTAGRAM_GRAPH_ACCESS_TOKEN に手動で貼る
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { ok: false, error: 'INSTAGRAM_APP_SECRET が未設定です' },
      { status: 500 }
    );
  }

  let shortToken: string;
  try {
    const body = await req.json() as { short_token?: unknown };
    if (typeof body.short_token !== 'string' || !body.short_token) {
      return NextResponse.json(
        { ok: false, error: 'short_token が必要です' },
        { status: 400 }
      );
    }
    shortToken = body.short_token;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'リクエストボディのパースに失敗しました' },
      { status: 400 }
    );
  }

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortToken);

  const res = await fetch(url.toString());
  const data = await res.json() as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message: string; type: string; code: number };
  };

  if (!res.ok || data.error) {
    return NextResponse.json(
      { ok: false, error: data.error?.message ?? 'Instagram APIがエラーを返しました' },
      { status: res.ok ? 400 : res.status }
    );
  }

  const expiresIn = data.expires_in ?? 0;
  return NextResponse.json({
    ok: true,
    long_lived_token: data.access_token,
    expires_in: expiresIn,
    expires_in_days: Math.floor(expiresIn / 86400),
  });
}
