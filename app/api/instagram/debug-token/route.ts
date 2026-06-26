// DEBUG ONLY: 確認後に削除
import { NextResponse } from 'next/server';
import { getInstagramAccessTokenState } from '@/lib/instagram-token-manager';

export async function GET() {
  const { state } = await getInstagramAccessTokenState();
  return NextResponse.json({
    has_token: state.source !== 'missing',
    masked_token: state.maskedToken,
    source: state.source,
    status: state.status
  });
}
