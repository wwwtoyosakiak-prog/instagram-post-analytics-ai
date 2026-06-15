import { NextResponse } from "next/server";
import { CategoryAiReport, InstagramAccount } from "@/lib/types";

type CategoryReportInput = {
  name: string;
  count: number;
  averageViews: number;
  averageSaveRate: number;
  averageEngagementRate: number;
  averageAiScore: number;
  sampleCaptions: string[];
};

export async function POST(request: Request) {
  const { categories, account, month } = (await request.json()) as { categories?: CategoryReportInput[]; account?: InstagramAccount | null; month?: string };
  const targetCategories = categories?.filter((category) => category.count > 0) ?? [];
  if (!targetCategories.length) return NextResponse.json({ error: "カテゴリ別レポートを作成する投稿データがありません。" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: ".env.local に OPENAI_API_KEY を設定してください。APIキーなしの場合はサンプルカテゴリレポートを使えます。" }, { status: 400 });
  }

  const prompt = `中小企業向けInstagram運用のカテゴリ別AIレポートを日本語で作成してください。JSONだけを返してください。

対象月: ${month ?? "未指定"}
対象アカウント: ${account ? `${account.name} @${account.username}` : "すべて"}
業種: ${account?.industry || "未設定"}
ターゲット: ${account?.targetAudience || "未設定"}
運用目的: ${account?.goal || "未設定"}

カテゴリ別データ:
${targetCategories.map((category) => `- ${category.name}: 投稿数=${category.count}, 平均表示数=${category.averageViews}, 平均保存率=${category.averageSaveRate.toFixed(2)}%, 平均ER=${category.averageEngagementRate.toFixed(2)}%, 平均AIスコア=${category.averageAiScore.toFixed(1)}, 投稿例=${category.sampleCaptions.join(" / ")}`).join("\n")}

返却形式:
{
  "overall": "カテゴリ全体の総評を160字以内",
  "items": [
    {
      "category": "カテゴリ名",
      "summary": "このカテゴリの傾向",
      "strength": "強み",
      "weakness": "弱み",
      "recommendation": "次にやるべき改善方針"
    }
  ]
}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    })
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data.error?.message ?? "OpenAI APIの呼び出しに失敗しました。" }, { status: response.status });
  const raw = data.output_text ?? data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");
  return NextResponse.json({ report: JSON.parse(raw) as CategoryAiReport });
}
