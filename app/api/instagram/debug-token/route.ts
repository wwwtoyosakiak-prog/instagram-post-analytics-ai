// DEBUG ONLY: 確認後に削除
import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN ?? '';
  return NextResponse.json({
    has_token: token.length > 0,
    length: token.length,
    first6: token.slice(0, 6),
    last4: token.slice(-4),
  });
}
