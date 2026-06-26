import { NextResponse } from "next/server";
import { recordInstagramTokenStatusCheck } from "@/lib/instagram-token-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await recordInstagramTokenStatusCheck();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "トークン状態を取得できませんでした。" },
      { status: 500 }
    );
  }
}
