import { NextResponse } from "next/server";
import { isSupabaseConfigured, listLatestInsightSnapshotsFromSupabase } from "@/lib/supabase-admin";

type InstagramApiPost = {
  id: string;
  caption?: string;
  timestamp?: string;
  media_type?: string;
  permalink?: string;
};

export async function POST(request: Request) {
  const { posts } = (await request.json()) as { posts?: InstagramApiPost[] };
  const targetPosts = posts?.filter((post) => post.caption?.trim()).slice(0, 30) ?? [];
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!targetPosts.length) {
    return NextResponse.json({ error: "分析できる投稿本文がありません。" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: ".env.local に OPENAI_API_KEY を設定してください。" }, { status: 400 });
  }

  const latestInsights = isSupabaseConfigured ? await listLatestInsightSnapshotsFromSupabase() : [];
  const insightByPostId = new Map(latestInsights.map((insight) => [insight.postId, insight]));

  const prompt = `Instagramビジネスアカウントの投稿本文を分析し、改善案を日本語でJSONだけ返してください。

投稿一覧:
${targetPosts.map((post) => {
  const insight = insightByPostId.get(post.id);
  const engagementRate = insight?.views ? ((insight.totalInteractions / insight.views) * 100).toFixed(2) : "未取得";
  const saveRate = insight?.views ? ((insight.saved / insight.views) * 100).toFixed(2) : "未取得";
  return `- id=${post.id}, timestamp=${post.timestamp ?? "不明"}, media_type=${post.media_type ?? "不明"}, views=${insight?.views ?? "未取得"}, reach=${insight?.reach ?? "未取得"}, saved=${insight?.saved ?? "未取得"}, shares=${insight?.shares ?? "未取得"}, total_interactions=${insight?.totalInteractions ?? "未取得"}, engagement_rate=${engagementRate}%, save_rate=${saveRate}%, caption=${post.caption}`;
}).join("\n")}

返却形式:
{
  "summary": "全体傾向を200字以内",
  "strengths": ["強み"],
  "weaknesses": ["課題"],
  "improvements": ["改善案"],
  "postIdeas": ["次に投稿するとよい案"],
  "hashtagAdvice": ["ハッシュタグ改善案"]
}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: { format: { type: "json_object" } }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message ?? "OpenAI APIの呼び出しに失敗しました。" }, { status: response.status });
  }

  const raw = data.output_text ?? data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");
  return NextResponse.json({ analysis: JSON.parse(raw), model });
}
