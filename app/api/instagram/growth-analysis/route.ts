import { NextResponse } from "next/server";
import { InstagramAccount, InstagramPost } from "@/lib/types";
import {
  ApiRequestError,
  apiErrorResponse,
  fetchJsonWithTimeout,
  isRecord,
  readJsonObject,
  readOpenAiOutput,
  readUpstreamError,
} from "@/lib/server-api";

type GrowthPost = {
  post: InstagramPost;
  growth: number;
  views: number;
  reach: number;
  snapshotCount: number;
};

export async function POST(request: Request) {
  try {
  const body = await readJsonObject(request);
  const posts = body.posts as GrowthPost[] | undefined;
  const period = body.period as "day" | "week" | "month" | undefined;
  const account = body.account as InstagramAccount | null | undefined;
  if (posts !== undefined && (!Array.isArray(posts) || posts.some((item) => !isRecord(item) || !isRecord(item.post)))) {
    throw new ApiRequestError("動画ランキングの形式が正しくありません。", 400);
  }
  if (period !== undefined && !["day", "week", "month"].includes(period)) {
    throw new ApiRequestError("分析期間が正しくありません。", 400);
  }
  const targets = posts?.slice(0, 5) ?? [];
  if (!targets.length) {
    return NextResponse.json({ error: "分析できる動画ランキングがありません。" }, { status: 400 });
  }

  const apiKeyEnvName = account?.openaiApiKeyEnvName?.trim();
  const apiKey = apiKeyEnvName ? process.env[apiKeyEnvName] : process.env.OPENAI_API_KEY;
  const model = account?.openaiModel?.trim() || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 400 });
  }

  const periodLabel = period === "day" ? "過去24時間" : period === "week" ? "過去7日" : "過去30日";
  const prompt = `あなたはInstagram動画運用の分析担当者です。${periodLabel}で伸びている上位動画の共通点を分析し、日本語のJSONだけを返してください。

対象アカウント: ${account ? `${account.name} @${account.username}` : "すべて"}
業種: ${account?.industry || "未設定"}
運用目的: ${account?.goal || "未設定"}

上位動画:
${targets.map((item, index) => {
  const hashtags = item.post.caption.match(/#[\p{L}\p{N}_]+/gu)?.join(" ") || "なし";
  return `${index + 1}位: 閲覧増加=${item.growth}, 現在閲覧=${item.views}, リーチ=${item.reach}, 投稿形式=${item.post.mediaType || item.post.type}, 投稿日=${item.post.date}, キャプション=${item.post.caption}, ハッシュタグ=${hashtags}`;
}).join("\n")}

返却形式:
{
  "summary": "伸びている動画全体の総評",
  "openingPatterns": ["冒頭文・フックの共通点"],
  "themes": ["テーマの共通点"],
  "formatPatterns": ["動画形式・構成の共通点"],
  "hashtagPatterns": ["ハッシュタグの共通点"],
  "nextActions": ["次回の具体的な投稿改善案"]
}`;

  const { response, data } = await fetchJsonWithTimeout("https://api.openai.com/v1/responses", {
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
  if (!response.ok) {
    return NextResponse.json({ error: readUpstreamError(data, "OpenAI APIの呼び出しに失敗しました。") }, { status: response.status });
  }
  const raw = readOpenAiOutput(data);
  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) throw new Error("not an object");
    parsed = value;
  } catch {
    throw new ApiRequestError("AI分析結果の形式が不正でした。もう一度分析してください。", 502);
  }
  const asList = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
  return NextResponse.json({
    analysis: {
      summary: typeof parsed.summary === "string" ? parsed.summary : "分析結果を取得しました。",
      openingPatterns: asList(parsed.openingPatterns),
      themes: asList(parsed.themes),
      formatPatterns: asList(parsed.formatPatterns),
      hashtagPatterns: asList(parsed.hashtagPatterns),
      nextActions: asList(parsed.nextActions)
    },
    model
  });
  } catch (error) {
    return apiErrorResponse(error, "growth-analysis-api");
  }
}
