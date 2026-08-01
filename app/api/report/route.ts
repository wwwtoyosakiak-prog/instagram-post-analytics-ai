import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/metrics";
import { InstagramAccount, InstagramPost, MonthlyReport } from "@/lib/types";
import {
  ApiRequestError,
  apiErrorResponse,
  fetchJsonWithTimeout,
  isRecord,
  readJsonObject,
  readOpenAiOutput,
  readUpstreamError,
} from "@/lib/server-api";

export async function POST(request: Request) {
  try {
  const body = await readJsonObject(request);
  const report = body.report as MonthlyReport | undefined;
  const posts = body.posts as InstagramPost[] | undefined;
  const account = body.account as InstagramAccount | null | undefined;
  if (!isRecord(report) || !Array.isArray(posts) || posts.some((post) => !isRecord(post))) {
    throw new ApiRequestError("レポートデータが正しくありません。", 400);
  }
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
${posts.map((post) => `- ${post.date} type=${post.type} views=${post.views} likes=${post.likes} saves=${post.saves} ER=${getMetrics(post).engagementRate.toFixed(2)}% caption=${post.caption}`).join("\n")}

400字以内で、良かった点、課題、来月の方針を含めてください。`;

  const { response, data } = await fetchJsonWithTimeout("https://api.openai.com/v1/responses", {
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
  if (!response.ok) return NextResponse.json({ error: readUpstreamError(data, "OpenAI APIの呼び出しに失敗しました。") }, { status: response.status });
  const summary = readOpenAiOutput(data);
  return NextResponse.json({ summary });
  } catch (error) {
    return apiErrorResponse(error, "report-api");
  }
}
