import { NextResponse } from "next/server";
import { InstagramAccount, InstagramPost } from "@/lib/types";
import { normalizeAiAnalysis } from "@/lib/ai-analysis";
import { buildAiAnalysisPrompt } from "@/lib/ai-analysis-prompt";
import { logServerIssue } from "@/lib/safe-logging";
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
    const post = body.post as InstagramPost | undefined;
    const account = body.account as InstagramAccount | null | undefined;
    if (!isRecord(post) || typeof post.caption !== "string" || typeof post.date !== "string") {
      throw new ApiRequestError("投稿データが正しくありません。", 400);
    }

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

  const prompt = buildAiAnalysisPrompt(post, account);

  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: prompt }];
  if (post.screenshot) {
    content.push({ type: "input_image", image_url: post.screenshot });
  }

  const { response, data } = await fetchJsonWithTimeout("https://api.openai.com/v1/responses", {
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
  if (!response.ok) {
    return NextResponse.json({ error: readUpstreamError(data, "OpenAI APIの呼び出しに失敗しました。") }, { status: response.status });
  }

  const raw = readOpenAiOutput(data);
  try {
    const analysis = normalizeAiAnalysis(JSON.parse(raw));
    return NextResponse.json({ analysis, model, apiKeyEnvName: apiKeyEnvName || "OPENAI_API_KEY" });
  } catch (error) {
    logServerIssue("analyze-response-parse", error);
    return NextResponse.json({ error: "AI分析結果の形式が不正でした。もう一度分析してください。" }, { status: 502 });
  }
  } catch (error) {
    return apiErrorResponse(error, "analyze-api");
  }
}
