import { NextResponse } from "next/server";
import { getInstagramAccessTokenState, updateInstagramTokenCheckTimestamp } from "@/lib/instagram-token-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await updateInstagramTokenCheckTimestamp();
    const { state } = await getInstagramAccessTokenState();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "トークン状態を取得できませんでした。" },
      { status: 500 }
    );
  }
}
