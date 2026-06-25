// DEBUG ONLY: 確認後に削除
import { NextResponse } from 'next/server';

export async function GET() {
  const secret = process.env.INSTAGRAM_APP_SECRET ?? '';
  return NextResponse.json({
    has_secret: secret.length > 0,
    length: secret.length,
    first2: secret.slice(0, 2),
    last2: secret.slice(-2),
  });
}
