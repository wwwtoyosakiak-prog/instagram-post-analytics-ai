import { NextResponse } from "next/server";
import { getMetrics, postCategoryLabels } from "@/lib/metrics";
import { InstagramAccount, InstagramPost, MonthlyReport } from "@/lib/types";

export async function POST(request: Request) {
  const { report, posts, account } = (await request.json()) as { report?: MonthlyReport; posts?: InstagramPost[]; account?: InstagramAccount | null };
  if (!report || !posts) return NextResponse.json({ error: "レポートデータがありません。" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: ".env.local に OPENAI_API_KEY を設定してください。APIキーなしの場合はサンプル総評を使えます。" }, { status: 400 });
  }

  const prompt = `Instagram運用の月次レポート総評を日本語で作成してください。
対象月: ${report.month}
対象アカウント: ${account ? `${account.name} @${account.username}` : "すべて"}
業種: ${account?.industry || "未設定"}
ターゲット: ${account?.targetAudience || "未設定"}
運用目的: ${account?.goal || "未設定"}
合計表示数: ${report.totalViews}
平均いいね数: ${report.averageLikes.toFixed(1)}
平均保存数: ${report.averageSaves.toFixed(1)}
平均エンゲージメント率: ${report.averageEngagementRate.toFixed(2)}%
投稿一覧:
${posts.map((post) => `- ${post.date} category=${postCategoryLabels[post.category ?? "other"]} type=${post.type} views=${post.views} likes=${post.likes} saves=${post.saves} ER=${getMetrics(post).engagementRate.toFixed(2)}% caption=${post.caption}`).join("\n")}

400字以内で、良かった点、課題、来月の方針を含めてください。`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: prompt
    })
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data.error?.message ?? "OpenAI APIの呼び出しに失敗しました。" }, { status: response.status });
  const summary = data.output_text ?? data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");
  return NextResponse.json({ summary });
}
