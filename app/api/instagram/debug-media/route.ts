// DEBUG ONLY: 実際のGraph APIレスポンスを確認する用途。確認後に削除可。
import { NextRequest, NextResponse } from "next/server";
import { getInstagramGraphConfig, createInstagramGraphUrl } from "@/lib/instagram-graph";

export const dynamic = "force-dynamic";

const FIELDS = [
  "id",
  "media_type",
  "media_product_type",
  "permalink",
  "timestamp",
  "caption",
  "like_count",
  "comments_count",
].join(",");

export async function GET(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get("id");
  if (!mediaId) {
    return NextResponse.json({ error: "id クエリパラメータが必要です。例: ?id=18096348136954660" }, { status: 400 });
  }

  try {
    const config = await getInstagramGraphConfig();
    const url = createInstagramGraphUrl(config, mediaId);
    url.searchParams.set("fields", FIELDS);
    url.searchParams.set("access_token", config.accessToken);

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    return NextResponse.json({
      api_mode: config.mode,
      base_url: config.baseUrl,
      version: config.version,
      requested_fields: FIELDS,
      response: data,
      isReel_by_media_product_type: data?.media_product_type === "REELS",
      isReel_by_permalink: typeof data?.permalink === "string" && data.permalink.includes("/reel/"),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "不明なエラー" },
      { status: 500 }
    );
  }
}
