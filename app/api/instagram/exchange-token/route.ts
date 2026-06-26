// 短期トークンを長期トークンへ交換し、サーバー側へ保存する
import { NextRequest, NextResponse } from 'next/server';
import { getInstagramAccessTokenState, storeInstagramAccessToken } from '@/lib/instagram-token-manager';

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
  try {
    await storeInstagramAccessToken(data.access_token!, expiresIn);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '長期トークンの保存に失敗しました' },
      { status: 500 }
    );
  }

  const { state } = await getInstagramAccessTokenState();
  return NextResponse.json({
    ok: true,
    message: '長期アクセストークンを保存しました。',
    token: state,
    expires_in: expiresIn,
    expires_in_days: Math.floor(expiresIn / 86400),
  });
}
