import { NextResponse } from "next/server";
import { createInstagramGraphUrl, getInstagramGraphConfig } from "@/lib/instagram-graph";

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
  error?: {
    message?: string;
  };
};

type InstagramMediaResponse = {
  data?: InstagramMedia[];
  error?: { message?: string };
};

export async function GET() {
  let config;
  try {
    config = await getInstagramGraphConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Instagram API設定が不正です。" },
      { status: 400 }
    );
  }

  const profileUrl = createInstagramGraphUrl(config, config.accountResource);
  profileUrl.searchParams.set("fields", "followers_count,follows_count,media_count");
  profileUrl.searchParams.set("access_token", config.accessToken);

  const mediaUrl = createInstagramGraphUrl(config, `${config.accountResource}/media`);
  mediaUrl.searchParams.set("fields", "id,caption,timestamp,media_type,permalink");
  mediaUrl.searchParams.set("limit", "100");
  mediaUrl.searchParams.set("access_token", config.accessToken);

  const [profileResponse, mediaResponse] = await Promise.all([
    fetch(profileUrl, { cache: "no-store" }),
    fetch(mediaUrl, { cache: "no-store" })
  ]);
  const profile = (await profileResponse.json()) as InstagramProfileResponse;
  const media = (await mediaResponse.json()) as InstagramMediaResponse;

  if (!profileResponse.ok || !mediaResponse.ok) {
    const status = !profileResponse.ok ? profileResponse.status : mediaResponse.status;
    return NextResponse.json({ error: profile.error?.message ?? media.error?.message ?? "Instagram Graph APIの取得に失敗しました。" }, { status });
  }

  return NextResponse.json({
    profile: {
      followers_count: profile.followers_count ?? 0,
      follows_count: profile.follows_count ?? 0,
      media_count: profile.media_count ?? 0
    },
    posts: media.data ?? [],
    apiMode: config.mode
  });
}
