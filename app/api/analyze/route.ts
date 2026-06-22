import { NextResponse } from "next/server";
import { getMetrics, getPostCategoryLabel, postTypeLabels } from "@/lib/metrics";
import { isSupabaseConfigured, listCategoriesFromSupabase } from "@/lib/supabase-admin";
import { InstagramAccount, InstagramPost } from "@/lib/types";

export async function POST(request: Request) {
  const { post, account } = (await request.json()) as { post?: InstagramPost; account?: InstagramAccount | null };
  if (!post) return NextResponse.json({ error: "投稿データがありません。" }, { status: 400 });

  const apiKeyEnvName = account?.openaiApiKeyEnvName?.trim();
  const apiKey = apiKeyEnvName ? process.env[apiKeyEnvName] : process.env.OPENAI_API_KEY;
  const model = account?.openaiModel?.trim() || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) {
    return NextResponse.json({
      error: apiKeyEnvName
        ? `.env.local またはVercelに ${apiKeyEnvName} を設定してください。`
        : ".env.local に OPENAI_API_KEY を設定してください。APIキーなしの場合はサンプル分析を使えます。"
    }, { status: 400 });
  }

  const metrics = getMetrics(post);
  const categories = isSupabaseConfigured ? await listCategoriesFromSupabase() : [];
  const prompt = `あなたは中小企業向けInstagram運用コンサルタントです。以下の投稿を分析し、JSONだけを返してください。

投稿:
- アカウント名: ${account?.name ?? "未設定"}
- ユーザー名: ${account?.username ? `@${account.username}` : "未設定"}
- 業種: ${account?.industry || "未設定"}
- ターゲット: ${account?.targetAudience || "未設定"}
- 運用目的: ${account?.goal || "未設定"}
- アカウント専用の分析方針: ${account?.analysisInstructions || "未設定"}
- 投稿日: ${post.date}
- データ登録日: ${post.recordedDate ?? post.date}
- 投稿URL: ${post.url || "なし"}
- 投稿タイプ: ${postTypeLabels[post.type]}
- 投稿カテゴリ: ${getPostCategoryLabel(post.category, categories)}
- 投稿画像・動画の枚数: ${post.mediaCount ?? 1}
- 投稿コメント: ${post.caption}
- ハッシュタグ: ${post.hashtags || "なし"}
- いいね数: ${post.likes}
- コメント数: ${post.comments}
- 保存数: ${post.saves}
- シェア数: ${post.shares}
- 表示数: ${post.views}
- エンゲージメント数: ${metrics.engagement}
- エンゲージメント率: ${metrics.engagementRate.toFixed(2)}%
- 保存率: ${metrics.saveRate.toFixed(2)}%
- コメント率: ${metrics.commentRate.toFixed(2)}%
- APIインサイト取得日時: ${post.latestInsight?.capturedAt ?? "未取得"}
- APIリーチ: ${post.latestInsight?.reach ?? "未取得"}
- API総インタラクション: ${post.latestInsight?.totalInteractions ?? "未取得"}
- 数値データの出典: ${post.latestInsight ? "Instagram Graph APIの最新同期値" : "手入力値"}
- メモ: ${post.memo || "なし"}

返却形式:
{
  "firstImpression": "string",
  "imageMessage": "string",
  "captionClarity": "string",
  "strengths": "string",
  "weaknesses": "string",
  "reason": "string",
  "improvements": ["string"],
  "nextIdeas": ["string"],
  "hashtags": ["string"],
  "score": 0
}`;

  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: prompt }];
  if (post.screenshot) {
    content.push({ type: "input_image", image_url: post.screenshot });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message ?? "OpenAI APIの呼び出しに失敗しました。" }, { status: response.status });
  }

  const raw = data.output_text ?? data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");
  return NextResponse.json({ analysis: JSON.parse(raw), model, apiKeyEnvName: apiKeyEnvName || "OPENAI_API_KEY" });
}
