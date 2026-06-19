import { NextResponse } from "next/server";

type InstagramMedia = {
  id: string;
  caption?: string;
  timestamp?: string;
  media_type?: string;
  permalink?: string;
};

type InstagramProfileResponse = {
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  media?: {
    data?: InstagramMedia[];
    paging?: {
      next?: string;
    };
  };
  error?: {
    message?: string;
  };
};

export async function GET() {
  const accessToken = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
  const instagramBusinessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v23.0";

  if (!accessToken || !instagramBusinessAccountId) {
    return NextResponse.json(
      { error: ".env.local またはVercelに INSTAGRAM_GRAPH_ACCESS_TOKEN と INSTAGRAM_BUSINESS_ACCOUNT_ID を設定してください。" },
      { status: 400 }
    );
  }

  const fields = "followers_count,follows_count,media_count,media.limit(100){id,caption,timestamp,media_type,permalink}";
  const url = new URL(`https://graph.facebook.com/${version}/${instagramBusinessAccountId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const data = (await response.json()) as InstagramProfileResponse;

  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message ?? "Instagram Graph APIの取得に失敗しました。" }, { status: response.status });
  }

  return NextResponse.json({
    profile: {
      followers_count: data.followers_count ?? 0,
      follows_count: data.follows_count ?? 0,
      media_count: data.media_count ?? 0
    },
    posts: data.media?.data ?? []
  });
}
