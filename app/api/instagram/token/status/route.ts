import { NextResponse } from "next/server";
import { recordInstagramTokenStatusCheck } from "@/lib/instagram-token-manager";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { getInstagramUserConfig } from "@/lib/instagram-user-config";
import { getStoredInstagramConnection } from "@/lib/instagram-connection-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = getAuthenticatedUser(request);
    if (ownerId !== "owner" || await getStoredInstagramConnection(ownerId)) {
      const stored = await getStoredInstagramConnection(ownerId);
      const configured = Boolean(getInstagramUserConfig(ownerId) || stored);
      return NextResponse.json({
        status: configured ? "active" : "missing",
        source: stored ? "database" : configured ? "user_environment" : "missing",
        expiresAt: stored?.expires_at ?? null,
        message: configured ? "このユーザー専用のInstagram連携が有効です。" : "Instagram連携はまだ設定されていません。",
      });
    }
    const state = await recordInstagramTokenStatusCheck();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "トークン状態を取得できませんでした。" },
      { status: 500 }
    );
  }
}
